import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import {
  isSchemaDiffClean,
  verifySchema,
  type SchemaColumn,
  type SchemaSnapshot,
} from '../../src/infrastructure/database/schema-verifier';
import snapshotJson from '../../src/infrastructure/database/schema/database-schema.json';

function column(
  overrides: Partial<SchemaColumn> & Pick<SchemaColumn, 'name' | 'position'>,
): SchemaColumn {
  return {
    table: 'contact_list',
    data_type: 'int',
    column_type: 'int',
    char_max_length: null,
    numeric_precision: 10,
    numeric_scale: 0,
    unsigned: false,
    nullable: false,
    default: null,
    auto_increment: false,
    key: null,
    charset: null,
    collation: null,
    ...overrides,
  };
}

const SNAPSHOT: SchemaSnapshot = {
  database: {},
  tables: [
    {
      name: 'contact_list',
      category: 'API_USED_TABLE',
      engine: 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      charset: 'utf8mb4',
      comment: null,
      used_by_apis: [],
    },
  ],
  columns: [
    column({ name: 'id', position: 1, auto_increment: true, key: 'PRI' }),
    column({ name: 'cid', position: 2, key: 'MUL' }),
  ],
  indexes: [
    { table: 'contact_list', name: 'PRIMARY', is_primary: true, unique: true, columns: ['id'] },
    {
      table: 'contact_list',
      name: 'contact_list_cid_index',
      is_primary: false,
      unique: false,
      columns: ['cid'],
    },
  ],
  foreignKeys: [],
};

const LIVE_TABLES = [{ TABLE_NAME: 'contact_list', ENGINE: 'InnoDB' }];
const LIVE_COLUMNS = [
  {
    TABLE_NAME: 'contact_list',
    COLUMN_NAME: 'id',
    DATA_TYPE: 'int',
    IS_NULLABLE: 'NO',
    EXTRA: 'auto_increment',
  },
  {
    TABLE_NAME: 'contact_list',
    COLUMN_NAME: 'cid',
    DATA_TYPE: 'int',
    IS_NULLABLE: 'NO',
    EXTRA: '',
  },
];
const LIVE_INDEXES = [
  {
    TABLE_NAME: 'contact_list',
    INDEX_NAME: 'contact_list_cid_index',
    NON_UNIQUE: 1,
    COLUMN_NAME: 'cid',
  },
  { TABLE_NAME: 'contact_list', INDEX_NAME: 'PRIMARY', NON_UNIQUE: 0, COLUMN_NAME: 'id' },
];

function livePool(
  overrides: { tables?: unknown[]; columns?: unknown[]; indexes?: unknown[] } = {},
): Pool {
  const query = vi
    .fn()
    .mockResolvedValueOnce([overrides.tables ?? LIVE_TABLES, []])
    .mockResolvedValueOnce([overrides.columns ?? LIVE_COLUMNS, []])
    .mockResolvedValueOnce([overrides.indexes ?? LIVE_INDEXES, []]);
  return { query } as unknown as Pool;
}

describe('verifySchema', () => {
  it('reports a clean diff when the live schema matches, ignoring extra live tables', async () => {
    const diff = await verifySchema(
      livePool({ tables: [...LIVE_TABLES, { TABLE_NAME: 'admin', ENGINE: 'MyISAM' }] }),
      SNAPSHOT,
    );

    expect(isSchemaDiffClean(diff)).toBe(true);
  });

  it('flags a MyISAM table when the snapshot expects InnoDB', async () => {
    const diff = await verifySchema(
      livePool({ tables: [{ TABLE_NAME: 'contact_list', ENGINE: 'MyISAM' }] }),
      SNAPSHOT,
    );

    expect(diff.unexpectedEngine).toEqual([
      { table: 'contact_list', expected: 'InnoDB', actual: 'MyISAM' },
    ]);
    expect(isSchemaDiffClean(diff)).toBe(false);
  });

  it('flags a missing primary key as a missing PRIMARY index', async () => {
    const diff = await verifySchema(
      livePool({ indexes: LIVE_INDEXES.filter((row) => row.INDEX_NAME !== 'PRIMARY') }),
      SNAPSHOT,
    );

    expect(diff.missingIndexes).toEqual([{ table: 'contact_list', index: 'PRIMARY' }]);
    expect(isSchemaDiffClean(diff)).toBe(false);
  });

  it('flags an index whose uniqueness or column list differs', async () => {
    const diff = await verifySchema(
      livePool({
        indexes: [
          LIVE_INDEXES[1],
          {
            TABLE_NAME: 'contact_list',
            INDEX_NAME: 'contact_list_cid_index',
            NON_UNIQUE: 0,
            COLUMN_NAME: 'cid',
          },
          {
            TABLE_NAME: 'contact_list',
            INDEX_NAME: 'contact_list_cid_index',
            NON_UNIQUE: 0,
            COLUMN_NAME: 'id',
          },
        ],
      }),
      SNAPSHOT,
    );

    expect(diff.indexMismatches).toEqual([
      {
        table: 'contact_list',
        index: 'contact_list_cid_index',
        expected: { is_primary: false, unique: false, columns: ['cid'] },
        actual: { is_primary: false, unique: true, columns: ['cid', 'id'] },
      },
    ]);
  });

  it('flags a column that lost its AUTO_INCREMENT attribute', async () => {
    const diff = await verifySchema(
      livePool({ columns: [{ ...LIVE_COLUMNS[0], EXTRA: '' }, LIVE_COLUMNS[1]] }),
      SNAPSHOT,
    );

    expect(diff.autoIncrementMismatches).toEqual([
      { table: 'contact_list', column: 'id', expected: true, actual: false },
    ]);
    expect(isSchemaDiffClean(diff)).toBe(false);
  });
});

describe('database-schema.json', () => {
  const snapshot: SchemaSnapshot = snapshotJson;

  it('contains exactly the 11 tables the Node backend uses, all InnoDB', () => {
    expect(snapshot.tables.map((table) => table.name).sort()).toEqual([
      'carousel',
      'consultations',
      'contact',
      'contact_class',
      'contact_idempotency_keys',
      'contact_list',
      'contact_quest',
      'faq',
      'node_schema_migrations',
      'seo',
      'users',
    ]);
    expect(snapshot.tables.every((table) => table.engine === 'InnoDB')).toBe(true);
  });

  it('gives every table a primary key', () => {
    for (const table of snapshot.tables) {
      expect(snapshot.indexes.some((index) => index.table === table.name && index.is_primary)).toBe(
        true,
      );
    }
  });
});
