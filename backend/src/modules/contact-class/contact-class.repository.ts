import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface ContactClassRow extends RowDataPacket {
  id: number;
  name: string;
  no: number;
  del: number;
  created_at: string | null;
  updated_at: string | null;
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
}
