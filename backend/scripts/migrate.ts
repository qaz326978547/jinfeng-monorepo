import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { loadEnv } from '../src/config/env';

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');
const TRACKING_TABLE = 'node_schema_migrations';

async function ensureTrackingTable(connection: mysql.Connection): Promise<void> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`${TRACKING_TABLE}\` (
      filename VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getAppliedMigrations(connection: mysql.Connection): Promise<Set<string>> {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT filename FROM \`${TRACKING_TABLE}\``,
  );
  return new Set(rows.map((row) => row.filename as string));
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function main(): Promise<void> {
  const env = loadEnv();
  const allowProduction = process.argv.includes('--allow-production');

  if (env.NODE_ENV === 'production' && !allowProduction) {
    console.error(
      '[migrate] Refusing to run migrations with NODE_ENV=production. ' +
        'This project never auto-migrates the production database. ' +
        'If you really intend to run this against a non-Zeabur production-labelled DB, ' +
        'pass --allow-production explicitly.',
    );
    process.exitCode = 1;
    return;
  }

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    multipleStatements: true,
  });

  try {
    await ensureTrackingTable(connection);
    const applied = await getAppliedMigrations(connection);
    const files = listMigrationFiles();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skip (already applied): ${file}`);
        continue;
      }
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] applying: ${file}`);
      await connection.query(sql);
      await connection.query(`INSERT INTO \`${TRACKING_TABLE}\` (filename) VALUES (?)`, [file]);
      console.log(`[migrate] applied: ${file}`);
    }

    console.log('[migrate] done');
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error('[migrate] failed:', error);
  process.exitCode = 1;
});
