import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../../infrastructure/database/transaction';

export interface ContactClassRow extends RowDataPacket {
  id: number;
  name: string;
  no: number;
  del: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface DeleteByIdsResult {
  deletedIds: number[];
  missingIds: number[];
}

interface IdRow extends RowDataPacket {
  id: number;
}

export class ContactClassRepository {
  constructor(private readonly pool: Pool) {}

  /** Mirrors legacy ContactClassController@index: WHERE del=0 ORDER BY no DESC, no pagination. */
  async findAllActive(): Promise<ContactClassRow[]> {
    const [rows] = await this.pool.query<ContactClassRow[]>(
      'SELECT * FROM contact_class WHERE del = 0 ORDER BY no DESC',
    );
    return rows;
  }

  /** Mirrors legacy ContactClassController@show (used by GET /admin/contact-class/{id}). */
  async findByIdActive(id: number): Promise<ContactClassRow | null> {
    const [rows] = await this.pool.query<ContactClassRow[]>(
      'SELECT * FROM contact_class WHERE id = ? AND del = 0',
      [id],
    );
    return rows[0] ?? null;
  }

  private async findByIdOrThrow(id: number): Promise<ContactClassRow> {
    const [rows] = await this.pool.query<ContactClassRow[]>(
      'SELECT * FROM contact_class WHERE id = ?',
      [id],
    );
    const row = rows[0];
    if (!row) {
      throw new Error(`contact_class ${id} not found immediately after write`);
    }
    return row;
  }

  /**
   * Mirrors legacy ContactClassController@store: `del` is left to its table
   * DEFAULT 0. `created_at`/`updated_at` are explicitly set to `NOW()` —
   * these columns have no DB-level default/trigger, unlike legacy Eloquent
   * which auto-manages timestamps on every model save (see the same fix in
   * contact.repository.ts::insertContact for the bug this caused elsewhere).
   */
  async create(name: string, no: number): Promise<ContactClassRow> {
    const [result] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO contact_class (name, no, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
      [name, no],
    );
    return this.findByIdOrThrow(result.insertId);
  }

  /**
   * Mirrors legacy ContactClassController@update: look up WHERE id=? AND
   * del=0 first (a nonexistent id or a soft-deleted row are both a 404),
   * then update only `name`/`no` — never `del`.
   */
  async updateActive(id: number, name: string, no: number): Promise<ContactClassRow | null> {
    const existing = await this.findByIdActive(id);
    if (!existing) {
      return null;
    }
    await this.pool.query('UPDATE contact_class SET name = ?, no = ? WHERE id = ?', [name, no, id]);
    return this.findByIdOrThrow(id);
  }

  /**
   * Mirrors legacy ContactClassController@destroy: a real hard DELETE of
   * the whole row (not `del=1`) — see known-legacy-issues.md #10, preserved
   * deliberately, not "fixed" into a soft delete. If any requested id
   * doesn't exist, nothing is deleted (existence check + delete wrapped in
   * one transaction — an intentional reliability improvement over the
   * legacy two-step, non-transactional check-then-delete; the observable
   * all-or-nothing behavior itself is unchanged).
   */
  async deleteByIds(ids: number[]): Promise<DeleteByIdsResult> {
    return withTransaction(this.pool, async (connection) => {
      const placeholders = ids.map(() => '?').join(', ');
      const [existingRows] = await connection.query<IdRow[]>(
        `SELECT id FROM contact_class WHERE id IN (${placeholders})`,
        ids,
      );
      const existingIds = new Set(existingRows.map((row) => row.id));
      const missingIds = ids.filter((id) => !existingIds.has(id));
      if (missingIds.length > 0) {
        return { deletedIds: [], missingIds };
      }

      await connection.query(`DELETE FROM contact_class WHERE id IN (${placeholders})`, ids);
      return { deletedIds: ids, missingIds: [] };
    });
  }
}
