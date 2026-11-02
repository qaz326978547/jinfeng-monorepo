// db-query-readonly.ts — run one or more SELECTs inside a READ ONLY transaction (writes are rejected
// by MySQL). Output is JSON per statement; select only the columns you need — never password hashes.
// Run from backend/:
//   node ../docs/change/tools/with-db-env.mjs <cnf> -- npx tsx ../docs/change/tools/db-query-readonly.ts "SELECT ..."
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../../backend/src');

async function main(): Promise<void> {
  const { loadEnv } = await import(`${SRC}/config/env`);
  const { buildPoolOptions } = await import(`${SRC}/config/database`);
  const { createPool } = await import(`${SRC}/infrastructure/database/client`);
  const pool = createPool({ ...buildPoolOptions(loadEnv()), connectionLimit: 1 });
  const connection = await pool.getConnection();
  try {
    await connection.query('START TRANSACTION READ ONLY');
    for (const sql of process.argv.slice(2)) {
      const [rows] = await connection.query(sql);
      console.log(JSON.stringify(rows));
    }
    await connection.query('ROLLBACK');
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error: Error & { code?: string }) => {
  console.error('FAILED:', error.code ?? '', error.message.split('\n')[0]);
  process.exit(1);
});
