// db-check.ts — connect exactly like the backend (TLS, CA + hostname verified) and print metadata only.
// Run from backend/:  node ../docs/change/tools/with-db-env.mjs <cnf> -- npx tsx ../docs/change/tools/db-check.ts
// Prints no credentials and no row data.
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../../backend/src');

async function main(): Promise<void> {
  const { loadEnv } = await import(`${SRC}/config/env`);
  const { buildPoolOptions } = await import(`${SRC}/config/database`);
  const { createPool } = await import(`${SRC}/infrastructure/database/client`);
  const pool = createPool({ ...buildPoolOptions(loadEnv()), connectionLimit: 1 });
  try {
    const q = async (sql: string) => (await pool.query(sql))[0] as Array<Record<string, unknown>>;
    const [info] = await q(
      `SELECT VERSION() AS version, DATABASE() AS db, CURRENT_USER() AS who,
              @@system_time_zone AS system_tz, @@time_zone AS tz,
              @@sql_require_primary_key AS require_pk, @@innodb_autoinc_lock_mode AS autoinc_mode,
              @@max_connections AS max_conn, ROUND(@@innodb_buffer_pool_size/1024/1024) AS buffer_pool_mb,
              @@binlog_expire_logs_seconds AS binlog_expire_s, @@global.sql_mode AS sql_mode`,
    );
    const tls = await q("SHOW SESSION STATUS WHERE Variable_name IN ('Ssl_version','Ssl_cipher')");
    const tables = await q(
      'SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME',
    );
    console.log(
      JSON.stringify(
        { ...info, tls: Object.fromEntries(tls.map((r) => [r.Variable_name, r.Value])) },
        null,
        2,
      ),
    );
    console.log(
      `tables in ${String(info?.db)}: ${tables.length}`,
      tables.map((t) => `${String(t.name)}(${String(t.engine)})`).join(', '),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: Error & { code?: string }) => {
  console.error('FAILED:', error.code ?? '', error.message.split('\n')[0]);
  process.exit(1);
});
