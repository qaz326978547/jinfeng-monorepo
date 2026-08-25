import mysql, { type Pool, type PoolOptions } from 'mysql2/promise';

let pool: Pool | undefined;

export function createPool(options: PoolOptions): Pool {
  pool = mysql.createPool(options);
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
