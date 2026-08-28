import mysql from 'mysql2/promise';
import { loadEnv } from '../src/config/env';
import { isSchemaDiffClean, verifySchema } from '../src/infrastructure/database/schema-verifier';
import snapshot from '../src/infrastructure/database/schema/database-schema.json';

/**
 * Read-only. Only ever issues SELECTs against information_schema — safe to
 * run against production. Never call any DDL-capable function from here.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  });

  try {
    const diff = await verifySchema(pool, snapshot);
    const clean = isSchemaDiffClean(diff);

    console.log(JSON.stringify(diff, null, 2));
    console.log(
      clean
        ? '[verify-schema] OK: schema matches reference snapshot'
        : '[verify-schema] MISMATCH found',
    );

    process.exitCode = clean ? 0 : 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[verify-schema] failed:', error);
  process.exitCode = 1;
});
