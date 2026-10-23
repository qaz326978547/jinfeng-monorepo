import type { PoolOptions } from 'mysql2/promise';
import type { Env } from './env';

/**
 * Pool tuning for a single backend instance against DigitalOcean Managed
 * MySQL (plan A: 75 connections). All options below exist in mysql2 3.23.1
 * (lib/connection_config.js, lib/pool_config.js); mysql2 has no
 * "acquire timeout" option, so that one is enforced in
 * infrastructure/database/client.ts instead.
 */
export const DB_POOL_SETTINGS = {
  /** TCP + handshake timeout for opening a new connection. */
  connectTimeoutMs: 10_000,
  /** TCP keep-alive probes on idle sockets, so dead peers / NAT drops are noticed. */
  keepAliveInitialDelayMs: 30_000,
  /**
   * Below connectionLimit so mysql2 runs its idle sweeper; together with
   * idleTimeoutMs it closes connections idle for more than 5 minutes (down to
   * zero), instead of keeping all of them open indefinitely.
   */
  maxIdle: 3,
  idleTimeoutMs: 5 * 60_000,
  /** Requests waiting for a free connection beyond this fail immediately. */
  queueLimit: 50,
  /** Max time a request waits in that queue (client.ts). */
  acquireTimeoutMs: 10_000,
} as const;

/**
 * TLS options for every MySQL connection this codebase opens — the app pool
 * and the db:migrate / db:verify scripts alike.
 */
export function buildSslOptions(env: Pick<Env, 'DB_SSL' | 'DB_SSL_CA'>): Pick<PoolOptions, 'ssl'> {
  if (!env.DB_SSL) {
    return {};
  }
  return {
    ssl: {
      ca: env.DB_SSL_CA,
      // Never false: an unverified certificate means no protection
      // against a man-in-the-middle.
      rejectUnauthorized: true,
      // mysql2 defaults this to false; without it the certificate is
      // trusted for ANY hostname signed by the CA.
      verifyIdentity: true,
      minVersion: 'TLSv1.2',
    },
  };
}

export function buildPoolOptions(
  env: Pick<
    Env,
    | 'DB_HOST'
    | 'DB_PORT'
    | 'DB_USER'
    | 'DB_PASSWORD'
    | 'DB_DATABASE'
    | 'DB_CONNECTION_LIMIT'
    | 'DB_SSL'
    | 'DB_SSL_CA'
  >,
): PoolOptions {
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    waitForConnections: true,
    dateStrings: true,
    connectTimeout: DB_POOL_SETTINGS.connectTimeoutMs,
    enableKeepAlive: true,
    keepAliveInitialDelay: DB_POOL_SETTINGS.keepAliveInitialDelayMs,
    maxIdle: DB_POOL_SETTINGS.maxIdle,
    idleTimeout: DB_POOL_SETTINGS.idleTimeoutMs,
    queueLimit: DB_POOL_SETTINGS.queueLimit,
    ...buildSslOptions(env),
  };
}
