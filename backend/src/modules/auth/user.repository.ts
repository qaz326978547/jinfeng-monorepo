import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  password: string;
  is_admin: number;
}

export class UserRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    const [rows] = await this.pool.query<UserRow[]>(
      'SELECT id, email, password, is_admin FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    return rows[0] ?? null;
  }
}
