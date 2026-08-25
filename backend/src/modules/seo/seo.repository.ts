import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface SeoRow extends RowDataPacket {
  id: number;
  class_id: number | null;
  relate_id: number;
  tag: string;
  name: string;
  title: string;
  description: string;
  url: string;
  type: string;
  keyword: string;
  pic: string;
  pic_alt: string;
  del: number;
  created_at: string | null;
  updated_at: string | null;
}

export class SeoRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Mirrors legacy SeoController@index: SELECT * FROM seo, no filter, no
   * order. `del` is intentionally NOT filtered — see
   * specs/backend/migration-history/known-legacy-issues.md #6.
   */
  async findAll(): Promise<SeoRow[]> {
    const [rows] = await this.pool.query<SeoRow[]>('SELECT * FROM seo');
    return rows;
  }
}
