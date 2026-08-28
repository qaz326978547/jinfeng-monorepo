import type { PoolOptions } from 'mysql2/promise';
import type { Env } from './env';

export function buildPoolOptions(
  env: Pick<
    Env,
    'DB_HOST' | 'DB_PORT' | 'DB_USER' | 'DB_PASSWORD' | 'DB_DATABASE' | 'DB_CONNECTION_LIMIT'
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
  };
}
