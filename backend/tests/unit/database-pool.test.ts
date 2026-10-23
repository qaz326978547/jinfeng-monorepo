import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPoolOptions, DB_POOL_SETTINGS } from '../../src/config/database';
import {
  applyAcquireTimeout,
  isPoolSaturationError,
  POOL_ACQUIRE_TIMEOUT_CODE,
} from '../../src/infrastructure/database/client';
import { createMailTransport, MAIL_TIMEOUTS } from '../../src/infrastructure/mail/mail-transport';

const BASE_ENV = {
  DB_HOST: 'db.example.com',
  DB_PORT: 25060,
  DB_USER: 'app',
  DB_PASSWORD: 'pw',
  DB_DATABASE: 'jinfeng',
  DB_CONNECTION_LIMIT: 10,
  DB_SSL: false,
  DB_SSL_CA: '',
};

describe('buildPoolOptions', () => {
  it('keeps the connection limit and applies keep-alive, idle reaping, a bounded queue and a connect timeout', () => {
    const options = buildPoolOptions(BASE_ENV);

    expect(options).toMatchObject({
      connectionLimit: 10,
      waitForConnections: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: DB_POOL_SETTINGS.keepAliveInitialDelayMs,
      maxIdle: DB_POOL_SETTINGS.maxIdle,
      idleTimeout: DB_POOL_SETTINGS.idleTimeoutMs,
      queueLimit: DB_POOL_SETTINGS.queueLimit,
      connectTimeout: DB_POOL_SETTINGS.connectTimeoutMs,
    });
    // mysql2 only runs its idle sweeper when maxIdle < connectionLimit.
    expect(DB_POOL_SETTINGS.maxIdle).toBeLessThan(options.connectionLimit ?? 0);
  });

  it('sends no TLS options when DB_SSL is off', () => {
    expect(buildPoolOptions(BASE_ENV).ssl).toBeUndefined();
  });

  it('verifies the CA and the server hostname when DB_SSL is on', () => {
    const ca = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
    const options = buildPoolOptions({ ...BASE_ENV, DB_SSL: true, DB_SSL_CA: ca });

    expect(options.ssl).toEqual({
      ca,
      rejectUnauthorized: true,
      verifyIdentity: true,
      minVersion: 'TLSv1.2',
    });
  });
});

type Callback = (error: Error | null, connection?: { release(): void }) => void;

/** Stand-in for mysql2's core pool: callbacks queue until `free()` hands out a connection. */
function fakeCorePool() {
  const queue: Callback[] = [];
  const connection = { release: vi.fn() };
  return {
    connection,
    queue,
    getConnection: vi.fn((callback: Callback) => {
      queue.push(callback);
    }),
    free() {
      queue.shift()?.(null, connection);
    },
  };
}

describe('applyAcquireTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes the connection through when one frees up in time', () => {
    vi.useFakeTimers();
    const pool = fakeCorePool();
    applyAcquireTimeout(pool, 1_000);
    const callback = vi.fn();

    pool.getConnection(callback);
    vi.advanceTimersByTime(500);
    pool.free();
    vi.advanceTimersByTime(1_000);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null, pool.connection);
    expect(pool.connection.release).not.toHaveBeenCalled();
  });

  it('fails the waiter with POOL_ACQUIRE_TIMEOUT and hands a late connection straight back', () => {
    vi.useFakeTimers();
    const pool = fakeCorePool();
    applyAcquireTimeout(pool, 1_000);
    const callback = vi.fn();

    pool.getConnection(callback);
    vi.advanceTimersByTime(1_000);

    expect(callback).toHaveBeenCalledTimes(1);
    const error = callback.mock.calls[0]?.[0] as Error & { code?: string };
    expect(error.code).toBe(POOL_ACQUIRE_TIMEOUT_CODE);
    expect(isPoolSaturationError(error)).toBe(true);

    pool.free();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(pool.connection.release).toHaveBeenCalledTimes(1);
  });

  it('does not stack a second timer when mysql2 re-enters getConnection with a queued callback', () => {
    vi.useFakeTimers();
    const pool = fakeCorePool();
    applyAcquireTimeout(pool, 1_000);
    const callback = vi.fn();

    pool.getConnection(callback);
    const queued = pool.queue.shift() as Callback;
    vi.advanceTimersByTime(600);
    pool.getConnection(queued); // what mysql2 does after discarding a dead connection
    vi.advanceTimersByTime(400);

    expect(callback).toHaveBeenCalledTimes(1);
    expect((callback.mock.calls[0]?.[0] as Error & { code?: string }).code).toBe(
      POOL_ACQUIRE_TIMEOUT_CODE,
    );
  });
});

describe('isPoolSaturationError', () => {
  it('recognises mysql2 queue-limit errors and nothing else', () => {
    expect(isPoolSaturationError(new Error('Queue limit reached.'))).toBe(true);
    expect(isPoolSaturationError(new Error('ER_DUP_ENTRY'))).toBe(false);
    expect(isPoolSaturationError('Queue limit reached.')).toBe(false);
  });
});

describe('createMailTransport', () => {
  it('bounds connect, greeting and socket time instead of nodemailer defaults', () => {
    const transport = createMailTransport({
      host: 'smtp.example.com',
      port: 587,
      username: '',
      password: '',
      encryption: 'tls',
    });

    const options = (transport as unknown as { options: Record<string, unknown> }).options;
    expect(options).toMatchObject({
      connectionTimeout: MAIL_TIMEOUTS.connectionTimeoutMs,
      greetingTimeout: MAIL_TIMEOUTS.greetingTimeoutMs,
      socketTimeout: MAIL_TIMEOUTS.socketTimeoutMs,
    });
  });
});
