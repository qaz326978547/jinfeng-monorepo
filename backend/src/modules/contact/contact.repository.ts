import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../../infrastructure/database/transaction';
import type { CreateContactRequest } from './contact.schemas';

export interface ContactRow extends RowDataPacket {
  id: number;
  class: string;
  quest: string;
  company: string;
  tel: string;
  num: string;
  last5: string | null;
  ticket: string | null;
  ticket_name: string | null;
  ticket_no: string | null;
  ticket_address: string | null;
  from: string | null;
  suggest_name: string | null;
  del: number;
  no: number;
  created_at: string | null;
  updated_at: string | null;
}

export class ContactRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Mirrors legacy ContactController@store (api-business-logic.md #4):
   * insert `contact`, then insert one `contact_list` row per item — all in
   * one transaction (intentional reliability improvement over the legacy
   * no-transaction behavior, see known-legacy-issues.md #8). `del`/`no` are
   * left to their table DEFAULT 0, never set from the request.
   */
  async createWithContactList(input: CreateContactRequest): Promise<ContactRow> {
    return withTransaction(this.pool, async (connection) => {
      const contactId = await this.insertContact(connection, input);
      await this.insertContactList(connection, contactId, input.contactList);
      return this.findByIdOrThrow(connection, contactId);
    });
  }

  private async insertContact(
    connection: PoolConnection,
    input: CreateContactRequest,
  ): Promise<number> {
    const [result] = await connection.query<ResultSetHeader>(
      'INSERT INTO contact (class, quest, company, tel, num, last5, ticket, ticket_name, ticket_no, ticket_address, `from`, suggest_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.class,
        input.quest,
        input.company,
        input.tel,
        input.num,
        input.last5 ?? null,
        input.ticket ?? null,
        input.ticket_name ?? null,
        input.ticket_no ?? null,
        input.ticket_address ?? null,
        input.from ?? null,
        input.suggest_name ?? null,
      ],
    );
    return result.insertId;
  }

  private async insertContactList(
    connection: PoolConnection,
    contactId: number,
    contactList: CreateContactRequest['contactList'],
  ): Promise<void> {
    // Zod (contact.schemas.ts) already requires `email` on every item, so
    // this filter can never actually drop anything today — kept to
    // faithfully mirror the legacy controller's own defensive check
    // (`is_array($item) && array_key_exists('email', $item)`,
    // api-specification.md #4 "特殊條件") in case that ever changes.
    const itemsWithEmail = contactList.filter((item) => Boolean(item.email));

    for (const item of itemsWithEmail) {
      await connection.query(
        'INSERT INTO contact_list (name, email, job, cel, cid) VALUES (?, ?, ?, ?, ?)',
        [item.name, item.email, item.job ?? null, item.cel, contactId],
      );
    }
  }

  private async findByIdOrThrow(connection: PoolConnection, id: number): Promise<ContactRow> {
    const [rows] = await connection.query<ContactRow[]>('SELECT * FROM contact WHERE id = ?', [
      id,
    ]);
    const row = rows[0];
    if (!row) {
      throw new Error(`contact ${id} not found immediately after insert`);
    }
    return row;
  }
}
