import mysql, { type Pool, type PoolOptions } from 'mysql2/promise';

let pool: Pool | undefined;

export const POOL_ACQUIRE_TIMEOUT_CODE = 'POOL_ACQUIRE_TIMEOUT';
/** mysql2's own error when `queueLimit` is reached (it sets no `code`). */
const QUEUE_LIMIT_MESSAGE = 'Queue limit reached.';

type GetConnectionCallback = (error: Error | null, connection?: { release(): void }) => void;

interface CorePoolLike {
  getConnection(callback: GetConnectionCallback): void;
}

const WRAPPED = Symbol('acquireTimeoutWrapped');

/**
 * mysql2 3.x has no acquire timeout: a request that cannot get a connection
 * waits in the pool queue indefinitely. This wraps the core pool's
 * getConnection (used by pool.query, pool.execute and pool.getConnection) so
 * a waiter gives up after `timeoutMs`. A waiter that already gave up stays
 * in mysql2's queue until a connection frees up, and then hands that
 * connection straight back to the pool.
 */
export function applyAcquireTimeout(corePool: CorePoolLike, timeoutMs: number): void {
  const original = corePool.getConnection.bind(corePool);

  corePool.getConnection = (callback: GetConnectionCallback) => {
    // mysql2 re-enters getConnection with an already-queued callback when a
    // pooled connection turns out to be dead — don't start a second timer.
    if ((callback as GetConnectionCallback & { [WRAPPED]?: true })[WRAPPED]) {
      original(callback);
      return;
    }

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      callback(
        Object.assign(new Error(`Timed out after ${timeoutMs}ms waiting for a MySQL connection`), {
          code: POOL_ACQUIRE_TIMEOUT_CODE,
        }),
      );
    }, timeoutMs);
    timer.unref();

    const wrapped: GetConnectionCallback & { [WRAPPED]?: true } = (error, connection) => {
      if (timedOut) {
        connection?.release();
        return;
      }
      clearTimeout(timer);
      callback(error, connection);
    };
    wrapped[WRAPPED] = true;
    original(wrapped);
  };
}

/** True when a query failed because the pool was saturated, not because of SQL/DB errors. */
export function isPoolSaturationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    (error as Error & { code?: string }).code === POOL_ACQUIRE_TIMEOUT_CODE ||
    error.message === QUEUE_LIMIT_MESSAGE
  );
}

export function createPool(options: PoolOptions, acquireTimeoutMs?: number): Pool {
  pool = mysql.createPool(options);
  if (acquireTimeoutMs !== undefined) {
    applyAcquireTimeout(pool.pool, acquireTimeoutMs);
  }
  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('MySQL pool has not been initialised. Call createPool() first.');
  }
  return pool;
}

export async function pingPool(target: Pick<Pool, 'query'> = getPool()): Promise<void> {
  await target.query('SELECT 1');
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
