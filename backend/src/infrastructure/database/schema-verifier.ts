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

export interface SchemaIndex {
  table: string;
  name: string;
  is_primary: boolean;
  unique: boolean;
  columns: string[];
}

export interface SchemaSnapshot {
  database: Record<string, unknown>;
  tables: SchemaTable[];
  columns: SchemaColumn[];
  indexes: SchemaIndex[];
  foreignKeys: unknown[];
}

type IndexShape = Pick<SchemaIndex, 'is_primary' | 'unique' | 'columns'>;

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
  autoIncrementMismatches: Array<{
    table: string;
    column: string;
    expected: boolean;
    actual: boolean;
  }>;
  /** Includes a missing PRIMARY KEY (index name `PRIMARY`). */
  missingIndexes: Array<{ table: string; index: string }>;
  indexMismatches: Array<{
    table: string;
    index: string;
    expected: IndexShape;
    actual: IndexShape;
  }>;
}

export function isSchemaDiffClean(diff: SchemaDiff): boolean {
  return (
    diff.missingTables.length === 0 &&
    diff.unexpectedEngine.length === 0 &&
    diff.missingColumns.length === 0 &&
    diff.columnTypeMismatches.length === 0 &&
    diff.nullabilityMismatches.length === 0 &&
    diff.autoIncrementMismatches.length === 0 &&
    diff.missingIndexes.length === 0 &&
    diff.indexMismatches.length === 0
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
  EXTRA: string;
}

interface LiveIndexRow extends RowDataPacket {
  TABLE_NAME: string;
  INDEX_NAME: string;
  NON_UNIQUE: number | string;
  COLUMN_NAME: string;
}

/**
 * Read-only comparison of the live database against the reference snapshot
 * (the 10 tables the Node backend uses, as imported into DigitalOcean).
 * Tables that exist live but not in the snapshot are ignored. Never issues
 * DDL — only SELECTs against information_schema, so it is safe to run
 * against production.
 */
export async function verifySchema(pool: Pool, snapshot: SchemaSnapshot): Promise<SchemaDiff> {
  const [tableRows] = await pool.query<LiveTableRow[]>(
    `SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`,
  );
  const liveTables = new Map(tableRows.map((row) => [row.TABLE_NAME, row.ENGINE]));

  const [columnRows] = await pool.query<LiveColumnRow[]>(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, EXTRA
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`,
  );
  const liveColumns = new Map<string, LiveColumnRow>(
    columnRows.map((row) => [`${row.TABLE_NAME}.${row.COLUMN_NAME}`, row]),
  );

  const [indexRows] = await pool.query<LiveIndexRow[]>(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, COLUMN_NAME
     FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
  );
  const liveIndexes = new Map<string, IndexShape>();
  for (const row of indexRows) {
    const key = `${row.TABLE_NAME}.${row.INDEX_NAME}`;
    let index = liveIndexes.get(key);
    if (!index) {
      index = {
        is_primary: row.INDEX_NAME === 'PRIMARY',
        unique: Number(row.NON_UNIQUE) === 0,
        columns: [],
      };
      liveIndexes.set(key, index);
    }
    index.columns.push(row.COLUMN_NAME);
  }

  const diff: SchemaDiff = {
    missingTables: [],
    unexpectedEngine: [],
    missingColumns: [],
    columnTypeMismatches: [],
    nullabilityMismatches: [],
    autoIncrementMismatches: [],
    missingIndexes: [],
    indexMismatches: [],
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
    const liveAutoIncrement = live.EXTRA.toLowerCase().includes('auto_increment');
    if (liveAutoIncrement !== column.auto_increment) {
      diff.autoIncrementMismatches.push({
        table: column.table,
        column: column.name,
        expected: column.auto_increment,
        actual: liveAutoIncrement,
      });
    }
  }

  for (const index of snapshot.indexes) {
    const live = liveIndexes.get(`${index.table}.${index.name}`);
    if (!live) {
      diff.missingIndexes.push({ table: index.table, index: index.name });
      continue;
    }
    const expected: IndexShape = {
      is_primary: index.is_primary,
      unique: index.unique,
      columns: index.columns,
    };
    if (
      live.is_primary !== expected.is_primary ||
      live.unique !== expected.unique ||
      live.columns.join(',') !== expected.columns.join(',')
    ) {
      diff.indexMismatches.push({ table: index.table, index: index.name, expected, actual: live });
    }
  }

  return diff;
}
