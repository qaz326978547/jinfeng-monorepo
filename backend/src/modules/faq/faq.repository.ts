import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface FaqRow extends RowDataPacket {
  id: number;
  name: string;
  info: string;
  no: number;
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
}
