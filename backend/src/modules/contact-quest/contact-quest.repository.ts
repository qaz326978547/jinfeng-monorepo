import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface ContactQuestRow extends RowDataPacket {
  id: number;
  name: string;
  no: number;
  del: number;
  created_at: string | null;
  updated_at: string | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export class ContactQuestRepository {
  constructor(private readonly pool: Pool) {}

  async countActive(): Promise<number> {
    const [rows] = await this.pool.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM contact_quest WHERE del = 0',
    );
    return Number(rows[0]?.total ?? 0);
  }

  /** Mirrors legacy ContactQuestController@index: WHERE del=0 ORDER BY no DESC, paginate(10). */
  async findPageActive(limit: number, offset: number): Promise<ContactQuestRow[]> {
    const [rows] = await this.pool.query<ContactQuestRow[]>(
      'SELECT * FROM contact_quest WHERE del = 0 ORDER BY no DESC LIMIT ? OFFSET ?',
      [limit, offset],
    );
    return rows;
  }
}
