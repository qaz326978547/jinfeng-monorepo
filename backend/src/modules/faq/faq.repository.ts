import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../../infrastructure/database/transaction';

export interface FaqRow extends RowDataPacket {
  id: number;
  name: string;
  info: string;
  no: number;
}

export interface DeleteByIdsResult {
  deletedIds: number[];
  missingIds: number[];
}

interface IdRow extends RowDataPacket {
  id: number;
}

export class FaqRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Mirrors legacy FAQController@index: projects only id/name/info/no out of
   * the full `faq` table. `del` is intentionally NOT filtered — see
   * specs/backend/migration-history/known-legacy-issues.md #6.
   */
  async findAllProjected(): Promise<FaqRow[]> {
    const [rows] = await this.pool.query<FaqRow[]>(
      'SELECT id, name, info, no FROM faq ORDER BY no DESC',
    );
    return rows;
  }

  /**
   * Admin list — same 4-column projection/order as the public endpoint.
   * There is no confirmed legacy admin FAQ contract (see
   * specs/backend/laravel-to-node-parity.md — this is a new Node/Admin
   * feature, not legacy parity), so this deliberately mirrors the public
   * query rather than inventing a different filter/order.
   */
  async findAllForAdmin(): Promise<FaqRow[]> {
    return this.findAllProjected();
  }

  async findById(id: number): Promise<FaqRow | null> {
    const [rows] = await this.pool.query<FaqRow[]>(
      'SELECT id, name, info, no FROM faq WHERE id = ?',
      [id],
    );
    return rows[0] ?? null;
  }

  private async findByIdOrThrow(id: number): Promise<FaqRow> {
    const row = await this.findById(id);
    if (!row) {
      throw new Error(`faq ${id} not found immediately after write`);
    }
    return row;
  }

  /**
   * `del`/`class_id`/and the other unused legacy columns are left to their
   * table DEFAULTs. `created_at`/`updated_at` are explicitly set to `NOW()`
   * — these columns have no DB-level default/trigger, unlike legacy
   * Eloquent which auto-manages timestamps on every model save (see the
   * same fix in contact.repository.ts::insertContact for the bug this
   * caused elsewhere).
   */
  async create(name: string, info: string, no: number): Promise<FaqRow> {
    const [result] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO faq (name, info, no, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [name, info, no],
    );
    return this.findByIdOrThrow(result.insertId);
  }

  /** Existence check first (404 on a nonexistent id), then update only name/info/no — never `del`. */
  async update(id: number, name: string, info: string, no: number): Promise<FaqRow | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.pool.query('UPDATE faq SET name = ?, info = ?, no = ? WHERE id = ?', [
      name,
      info,
      no,
      id,
    ]);
    return this.findByIdOrThrow(id);
  }

  /**
   * Hard delete — matches the implemented precedent for the same table
   * family (contact_class; see known-legacy-issues.md #10). Existence check
   * + delete wrapped in one transaction for atomic batch behaviour.
   */
  async deleteByIds(ids: number[]): Promise<DeleteByIdsResult> {
    return withTransaction(this.pool, async (connection) => {
      const placeholders = ids.map(() => '?').join(', ');
      const [existingRows] = await connection.query<IdRow[]>(
        `SELECT id FROM faq WHERE id IN (${placeholders})`,
        ids,
      );
      const existingIds = new Set(existingRows.map((row) => row.id));
      const missingIds = ids.filter((id) => !existingIds.has(id));
      if (missingIds.length > 0) {
        return { deletedIds: [], missingIds };
      }

      await connection.query(`DELETE FROM faq WHERE id IN (${placeholders})`, ids);
      return { deletedIds: ids, missingIds: [] };
    });
  }
}
