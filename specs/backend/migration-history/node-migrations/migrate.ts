#!/usr/bin/env node
/**
 * Minimal raw-SQL migration runner. See README.md for why this exists instead of an ORM
 * migration DSL. Tracks applied files in `node_schema_migrations` (own table, independent of
 * Laravel's `migrations` table).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadDbEnv, connect } from "./db";

const MIGRATIONS_DIR = join(__dirname, "migrations");
const GUARDED_TABLES = ["contact", "users", "contact_class", "contact_quest", "seo", "faq"];

async function main() {
  const env = loadDbEnv();
  const conn = await connect(env);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS node_schema_migrations (
      filename VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  if (env.NODE_ENV === "production" && !process.argv.includes("--allow-production")) {
    const [rows] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${GUARDED_TABLES.map((t) => `'${t}'`).join(",")})`
    );
    if ((rows as any[]).length > 0) {
      console.error(
        `Refusing to run migrations against what looks like an already-populated production ` +
          `database (found existing tables: ${(rows as any[]).map((r) => r.TABLE_NAME).join(", ")}). ` +
          `Run "npm run db:verify" instead, or pass --allow-production if you are certain.`
      );
      process.exit(1);
    }
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const [[already]] = (await conn.query(
      "SELECT 1 FROM node_schema_migrations WHERE filename = ? LIMIT 1",
      [file]
    )) as any[];
    if (already) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`apply ${file}`);
    await conn.query(sql);
    await conn.query("INSERT INTO node_schema_migrations (filename) VALUES (?)", [file]);
  }

  await conn.end();
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
