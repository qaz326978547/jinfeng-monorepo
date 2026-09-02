import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/**
 * DB columns are snake_case, but this is a new Node/Admin feature (no legacy parity to
 * mirror — see carousel.repository.ts for the same convention), so the API contract uses
 * camelCase. Aliasing in the SELECT keeps that mapping in one place.
 */
const FULL_COLUMNS = `
  id, title,
  source_name AS sourceName, source_url AS sourceUrl,
  published_at AS publishedAt, sort_order AS sortOrder, is_active AS isActive,
  created_at AS createdAt, updated_at AS updatedAt
`;

const PUBLIC_COLUMNS = `
  id, title,
  source_name AS sourceName, source_url AS sourceUrl,
  published_at AS publishedAt, sort_order AS sortOrder
`;

/**
 * Single sort rule for every list query (public and admin): manual sort_order wins first,
 * publishedAt is the tiebreaker when two rows share a sort_order, and id is the final
 * tiebreaker when both are equal. sort_order has no UNIQUE constraint (see the migration),
 * so this ordering is what actually keeps duplicate sort_order rows deterministic.
 */
const ORDER_BY_CLAUSE = 'ORDER BY sort_order ASC, published_at DESC, id DESC';

interface LaborNewsRow extends RowDataPacket {
  id: number;
  title: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  sortOrder: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

interface PublicLaborNewsRow extends RowDataPacket {
  id: number;
  title: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  sortOrder: number;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface LaborNews {
  id: number;
  title: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicLaborNews {
  id: number;
  title: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  sortOrder: number;
}

export interface LaborNewsWriteInput {
  title: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  sortOrder: number;
  isActive: boolean;
}

/** MySQL has no native boolean — TINYINT(1) comes back as 0/1, mapped to a real boolean here. */
function toLaborNews(row: LaborNewsRow): LaborNews {
  return { ...row, isActive: Boolean(row.isActive) };
}

export class LaborNewsRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * `keyword` (when non-empty) matches title OR source_name via parameterized LIKE —
   * never string-concatenated into the SQL text.
   */
  async countActive(keyword: string): Promise<number> {
    if (keyword) {
      const [rows] = await this.pool.query<CountRow[]>(
        'SELECT COUNT(*) AS total FROM labor_news WHERE is_active = 1 AND (title LIKE ? OR source_name LIKE ?)',
        [`%${keyword}%`, `%${keyword}%`],
      );
      return Number(rows[0]?.total ?? 0);
    }
    const [rows] = await this.pool.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM labor_news WHERE is_active = 1',
    );
    return Number(rows[0]?.total ?? 0);
  }

  async findActivePage(limit: number, offset: number, keyword: string): Promise<PublicLaborNews[]> {
    if (keyword) {
      const [rows] = await this.pool.query<PublicLaborNewsRow[]>(
        `SELECT ${PUBLIC_COLUMNS} FROM labor_news
         WHERE is_active = 1 AND (title LIKE ? OR source_name LIKE ?)
         ${ORDER_BY_CLAUSE}
         LIMIT ? OFFSET ?`,
        [`%${keyword}%`, `%${keyword}%`, limit, offset],
      );
      return rows;
    }
    const [rows] = await this.pool.query<PublicLaborNewsRow[]>(
      `SELECT ${PUBLIC_COLUMNS} FROM labor_news
       WHERE is_active = 1
       ${ORDER_BY_CLAUSE}
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return rows;
  }

  /** Admin sees both active and inactive rows, same ordering as the public endpoint. */
  async countAllForAdmin(): Promise<number> {
    const [rows] = await this.pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM labor_news');
    return Number(rows[0]?.total ?? 0);
  }

  async findPageForAdmin(limit: number, offset: number): Promise<LaborNews[]> {
    const [rows] = await this.pool.query<LaborNewsRow[]>(
      `SELECT ${FULL_COLUMNS} FROM labor_news ${ORDER_BY_CLAUSE} LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return rows.map(toLaborNews);
  }

  async findById(id: number): Promise<LaborNews | null> {
    const [rows] = await this.pool.query<LaborNewsRow[]>(
      `SELECT ${FULL_COLUMNS} FROM labor_news WHERE id = ?`,
      [id],
    );
    return rows[0] ? toLaborNews(rows[0]) : null;
  }

  private async findByIdOrThrow(id: number): Promise<LaborNews> {
    const row = await this.findById(id);
    if (!row) {
      throw new Error(`labor_news ${id} not found immediately after write`);
    }
    return row;
  }

  async create(input: LaborNewsWriteInput): Promise<LaborNews> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO labor_news
         (title, source_name, source_url, published_at, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.title,
        input.sourceName,
        input.sourceUrl,
        input.publishedAt,
        input.sortOrder,
        input.isActive ? 1 : 0,
      ],
    );
    return this.findByIdOrThrow(result.insertId);
  }

  /** Existence check first (null on a nonexistent id) so the controller can 404. */
  async update(id: number, input: LaborNewsWriteInput): Promise<LaborNews | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.pool.query(
      `UPDATE labor_news
       SET title = ?, source_name = ?, source_url = ?, published_at = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [
        input.title,
        input.sourceName,
        input.sourceUrl,
        input.publishedAt,
        input.sortOrder,
        input.isActive ? 1 : 0,
        id,
      ],
    );
    return this.findByIdOrThrow(id);
  }

  async deleteById(id: number): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      'DELETE FROM labor_news WHERE id = ?',
      [id],
    );
    return result.affectedRows > 0;
  }
}
