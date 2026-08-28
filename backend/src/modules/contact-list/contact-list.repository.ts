import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface ContactListRow extends RowDataPacket {
  id: number;
  name: string;
  cel: string | null;
  job: string | null;
  email: string | null;
  no: number;
  cid: number;
  created_at: string | null;
  updated_at: string | null;
}

export class ContactListRepository {
  constructor(private readonly pool: Pool) {}

  /** Mirrors legacy ContactListController@index: no filter, no order, no pagination. */
  async findAll(): Promise<ContactListRow[]> {
    const [rows] = await this.pool.query<ContactListRow[]>('SELECT * FROM contact_list');
    return rows;
  }

  /** Mirrors legacy ContactListController@show. */
  async findById(id: number): Promise<ContactListRow | null> {
    const [rows] = await this.pool.query<ContactListRow[]>(
      'SELECT * FROM contact_list WHERE id = ?',
      [id],
    );
    return rows[0] ?? null;
  }
}
