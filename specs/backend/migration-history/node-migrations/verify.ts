#!/usr/bin/env node
/**
 * READ-ONLY schema verification. Compares the live database (local or production — this is
 * safe to point at production) against the migration-spec/database-schema.json snapshot.
 * Never issues DDL.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadDbEnv, connect } from "./db";

interface SnapshotColumn {
  table: string;
  name: string;
  data_type: string;
  nullable: boolean;
  key: string | null;
}
interface SnapshotTable {
  name: string;
  category: string;
  engine: string;
}
interface Snapshot {
  tables: SnapshotTable[];
  columns: SnapshotColumn[];
}

async function main() {
  const env = loadDbEnv();
  const conn = await connect(env);

  const snapshotPath = join(__dirname, "..", "database-schema.json");
  const snapshot: Snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));

  const [tableRows] = (await conn.query(
    `SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`
  )) as any[];
  const liveTables = new Map<string, string>(tableRows.map((r: any) => [r.TABLE_NAME, r.ENGINE]));

  const [colRows] = (await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`
  )) as any[];
  const liveCols = new Map<string, any[]>();
  for (const r of colRows as any[]) {
    if (!liveCols.has(r.TABLE_NAME)) liveCols.set(r.TABLE_NAME, []);
    liveCols.get(r.TABLE_NAME)!.push(r);
  }

  const columnsByTable = new Map<string, SnapshotColumn[]>();
  for (const col of snapshot.columns) {
    if (!columnsByTable.has(col.table)) columnsByTable.set(col.table, []);
    columnsByTable.get(col.table)!.push(col);
  }

  let problems = 0;
  for (const table of snapshot.tables) {
    // Laravel's own migration-tracking table is intentionally not part of the Node app schema
    // (see sql/001-create-tables.sql header) — skip it here too.
    if (table.name === "migrations") continue;

    if (!liveTables.has(table.name)) {
      console.error(`MISSING TABLE: ${table.name} [${table.category}]`);
      problems++;
      continue;
    }
    if (liveTables.get(table.name) !== table.engine) {
      console.warn(
        `ENGINE MISMATCH: ${table.name} expected=${table.engine} actual=${liveTables.get(table.name)}`
      );
      problems++;
    }
    const actualCols = new Map((liveCols.get(table.name) ?? []).map((c: any) => [c.COLUMN_NAME, c]));
    for (const col of columnsByTable.get(table.name) ?? []) {
      const actual = actualCols.get(col.name);
      if (!actual) {
        console.error(`MISSING COLUMN: ${table.name}.${col.name}`);
        problems++;
        continue;
      }
      if (actual.DATA_TYPE !== col.data_type) {
        console.warn(
          `TYPE MISMATCH: ${table.name}.${col.name} expected=${col.data_type} actual=${actual.DATA_TYPE}`
        );
        problems++;
      }
    }
  }

  await conn.end();

  if (problems === 0) {
    console.log(`OK — live schema matches migration-spec/database-schema.json (${snapshot.tables.length} tables checked).`);
    process.exit(0);
  } else {
    console.error(`FAILED — ${problems} schema difference(s) found. No changes were made (read-only check).`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
