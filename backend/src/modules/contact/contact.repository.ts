import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../../infrastructure/database/transaction';
import type { ContactListRow } from '../contact-list/contact-list.repository';
import type { CreateContactRequest } from './contact.schemas';

interface CountRow extends RowDataPacket {
  total: number;
}

interface IdRow extends RowDataPacket {
  id: number;
}

export interface DeleteByIdsResult {
  deletedIds: number[];
  missingIds: number[];
}

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

  // ---- Admin read methods (GET /admin/contact, /admin/contact/{id},
  // /admin/contact/search/search-company) ----

  /** Mirrors legacy ContactController@index: ORDER BY created_at DESC, paginate(10). */
  async countAll(): Promise<number> {
    const [rows] = await this.pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM contact');
    return Number(rows[0]?.total ?? 0);
  }

  async findPage(limit: number, offset: number): Promise<ContactRow[]> {
    const [rows] = await this.pool.query<ContactRow[]>(
      'SELECT * FROM contact ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset],
    );
    return rows;
  }

  /** Mirrors legacy ContactController@show. */
  async findById(id: number): Promise<ContactRow | null> {
    const [rows] = await this.pool.query<ContactRow[]>('SELECT * FROM contact WHERE id = ?', [
      id,
    ]);
    return rows[0] ?? null;
  }

  /** The `with('contactList')` eager-load in ContactController@show. */
  async findContactListByContactId(cid: number): Promise<ContactListRow[]> {
    const [rows] = await this.pool.query<ContactListRow[]>(
      'SELECT * FROM contact_list WHERE cid = ?',
      [cid],
    );
    return rows;
  }

  /**
   * Mirrors legacy ContactController@searchCompany: parameterized LIKE,
   * paginate(10). No ORDER BY is documented for this endpoint (unlike
   * #9/index, which is explicitly `created_at DESC`) — none is added here;
   * MySQL's unspecified default row order applies, matching what the spec
   * actually says rather than assuming the index endpoint's ordering by
   * analogy.
   */
  async countByCompany(company: string): Promise<number> {
    const [rows] = await this.pool.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM contact WHERE company LIKE ?',
      [`%${company}%`],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async findByCompanyPage(company: string, limit: number, offset: number): Promise<ContactRow[]> {
    const [rows] = await this.pool.query<ContactRow[]>(
      'SELECT * FROM contact WHERE company LIKE ? LIMIT ? OFFSET ?',
      [`%${company}%`, limit, offset],
    );
    return rows;
  }

  /**
   * Mirrors legacy ContactController@destroy: a hard DELETE, and
   * deliberately does NOT cascade into `contact_list` (known-legacy-issues.md
   * #9 — the legacy DB has no enforced FK there, and orphaned contact_list
   * rows are the documented, preserved behavior, not a bug to fix). If any
   * requested id doesn't exist, nothing is deleted (existence check + delete
   * wrapped in one transaction — an intentional reliability improvement over
   * the legacy two-step, non-transactional check-then-delete; the observable
   * all-or-nothing behavior itself is unchanged).
   */
  async deleteByIds(ids: number[]): Promise<DeleteByIdsResult> {
    return withTransaction(this.pool, async (connection) => {
      const placeholders = ids.map(() => '?').join(', ');
      const [existingRows] = await connection.query<IdRow[]>(
        `SELECT id FROM contact WHERE id IN (${placeholders})`,
        ids,
      );
      const existingIds = new Set(existingRows.map((row) => row.id));
      const missingIds = ids.filter((id) => !existingIds.has(id));
      if (missingIds.length > 0) {
        return { deletedIds: [], missingIds };
      }

      await connection.query(`DELETE FROM contact WHERE id IN (${placeholders})`, ids);
      return { deletedIds: ids, missingIds: [] };
    });
  }
}
