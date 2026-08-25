import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface SchemaColumn {
  table: string;
  name: string;
  position: number;
  data_type: string;
  column_type: string;
  char_max_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  unsigned: boolean;
  nullable: boolean;
  default: string | null;
  auto_increment: boolean;
  key: string | null;
  charset: string | null;
  collation: string | null;
}

export interface SchemaTable {
  name: string;
  category: string;
  engine: string;
  collation: string | null;
  charset: string | null;
  comment: string | null;
  used_by_apis: string[];
}

export interface SchemaSnapshot {
  database: Record<string, unknown>;
  tables: SchemaTable[];
  columns: SchemaColumn[];
  indexes: Array<{
    table: string;
    name: string;
    is_primary: boolean;
    unique: boolean;
    columns: string[];
  }>;
  foreignKeys: unknown[];
}

export interface SchemaDiff {
  missingTables: string[];
  unexpectedEngine: Array<{ table: string; expected: string; actual: string }>;
  missingColumns: Array<{ table: string; column: string }>;
  columnTypeMismatches: Array<{ table: string; column: string; expected: string; actual: string }>;
  nullabilityMismatches: Array<{
    table: string;
    column: string;
    expected: boolean;
    actual: boolean;
  }>;
}

export function isSchemaDiffClean(diff: SchemaDiff): boolean {
  return (
    diff.missingTables.length === 0 &&
    diff.unexpectedEngine.length === 0 &&
    diff.missingColumns.length === 0 &&
    diff.columnTypeMismatches.length === 0 &&
    diff.nullabilityMismatches.length === 0
  );
}

interface LiveTableRow extends RowDataPacket {
  TABLE_NAME: string;
  ENGINE: string | null;
}

interface LiveColumnRow extends RowDataPacket {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: 'YES' | 'NO';
}

/**
 * Read-only comparison of the live database against the reference snapshot
 * generated from the legacy Laravel schema. Never issues DDL — only
 * SELECTs against information_schema, so it is safe to run against
 * production.
 */
export async function verifySchema(pool: Pool, snapshot: SchemaSnapshot): Promise<SchemaDiff> {
  const [tableRows] = await pool.query<LiveTableRow[]>(
    `SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`,
  );
  const liveTables = new Map(tableRows.map((row) => [row.TABLE_NAME, row.ENGINE]));

  const [columnRows] = await pool.query<LiveColumnRow[]>(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`,
  );
  const liveColumns = new Map<string, LiveColumnRow>(
    columnRows.map((row) => [`${row.TABLE_NAME}.${row.COLUMN_NAME}`, row]),
  );

  const diff: SchemaDiff = {
    missingTables: [],
    unexpectedEngine: [],
    missingColumns: [],
    columnTypeMismatches: [],
    nullabilityMismatches: [],
  };

  for (const table of snapshot.tables) {
    const liveEngine = liveTables.get(table.name);
    if (liveEngine === undefined) {
      diff.missingTables.push(table.name);
      continue;
    }
    if (liveEngine !== null && liveEngine !== table.engine) {
      diff.unexpectedEngine.push({ table: table.name, expected: table.engine, actual: liveEngine });
    }
  }

  for (const column of snapshot.columns) {
    const live = liveColumns.get(`${column.table}.${column.name}`);
    if (!live) {
      diff.missingColumns.push({ table: column.table, column: column.name });
      continue;
    }
    if (live.DATA_TYPE !== column.data_type) {
      diff.columnTypeMismatches.push({
        table: column.table,
        column: column.name,
        expected: column.data_type,
        actual: live.DATA_TYPE,
      });
    }
    const liveNullable = live.IS_NULLABLE === 'YES';
    if (liveNullable !== column.nullable) {
      diff.nullabilityMismatches.push({
        table: column.table,
        column: column.name,
        expected: column.nullable,
        actual: liveNullable,
      });
    }
  }

  return diff;
}
