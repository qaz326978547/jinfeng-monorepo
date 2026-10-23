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

interface IdempotencyKeyRow extends RowDataPacket {
  request_hash: string;
  contact_id: number | null;
}

/** An `Idempotency-Key` header value plus the SHA-256 of the validated body it was sent with. */
export interface IdempotencyClaim {
  key: string;
  requestHash: string;
}

export type CreateContactResult =
  | {
      kind: 'created';
      contact: ContactRow;
      /** false when the key table is missing (migration 008 not applied) — saved without dedup. */
      deduplicated: boolean;
    }
  | { kind: 'replayed'; contact: ContactRow }
  | { kind: 'conflict'; reason: 'different_request' | 'original_missing' };

class DuplicateIdempotencyKeyError extends Error {}

function isMysqlError(error: unknown, code: string): error is Error & { sqlMessage?: string } {
  return error instanceof Error && (error as Error & { code?: string }).code === code;
}

export class ContactRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Mirrors legacy ContactController@store (api-business-logic.md #4):
   * insert `contact`, then insert one `contact_list` row per item — all in
   * one transaction (intentional reliability improvement over the legacy
   * no-transaction behavior, see known-legacy-issues.md #8). `del`/`no` are
   * left to their table DEFAULT 0, never set from the request.
   *
   * `created_at`/`updated_at` are explicitly set to `NOW()` on both inserts —
   * these columns have no DB-level default/trigger (confirmed via
   * known-legacy-issues.md / 005_create_triggers.sql: 0 triggers), unlike
   * legacy Eloquent which auto-manages timestamps on every model save.
   * Leaving them unset produced NULL rows that sorted to the very last page
   * under `findPage()`'s `ORDER BY created_at DESC` (MySQL treats NULL as
   * the lowest value), making every new submission invisible on admin page 1.
   *
   * With an `idempotency` claim, the key is inserted first in the same
   * transaction (see migration 008): a concurrent request with the same key
   * waits on that primary-key row lock, then hits ER_DUP_ENTRY once this
   * transaction commits and is answered from the stored row instead of
   * creating a second registration.
   */
  async createWithContactList(
    input: CreateContactRequest,
    idempotency?: IdempotencyClaim,
  ): Promise<CreateContactResult> {
    try {
      return await withTransaction(this.pool, async (connection) => {
        const claimed = idempotency
          ? await this.claimIdempotencyKey(connection, idempotency)
          : false;
        const contactId = await this.insertContact(connection, input);
        await this.insertContactList(connection, contactId, input.contactList);
        if (idempotency && claimed) {
          await connection.query(
            'UPDATE contact_idempotency_keys SET contact_id = ? WHERE idempotency_key = ?',
            [contactId, idempotency.key],
          );
        }
        const contact = await this.findByIdOrThrow(connection, contactId);
        return { kind: 'created', contact, deduplicated: idempotency === undefined || claimed };
      });
    } catch (error) {
      if (idempotency && error instanceof DuplicateIdempotencyKeyError) {
        return this.resolveExistingKey(idempotency);
      }
      throw error;
    }
  }

  /**
   * true = key row inserted (this request owns it); false = the key table
   * does not exist (legacy database without migration 008) — the
   * registration is still saved, just without duplicate protection. A failed
   * statement does not abort a MySQL transaction, so carrying on is safe.
   */
  private async claimIdempotencyKey(
    connection: PoolConnection,
    claim: IdempotencyClaim,
  ): Promise<boolean> {
    try {
      await connection.query(
        'INSERT INTO contact_idempotency_keys (idempotency_key, request_hash) VALUES (?, ?)',
        [claim.key, claim.requestHash],
      );
      return true;
    } catch (error) {
      if (
        isMysqlError(error, 'ER_DUP_ENTRY') &&
        error.sqlMessage?.includes('contact_idempotency_keys.PRIMARY')
      ) {
        throw new DuplicateIdempotencyKeyError();
      }
      if (isMysqlError(error, 'ER_NO_SUCH_TABLE')) {
        return false;
      }
      throw error;
    }
  }

  private async resolveExistingKey(claim: IdempotencyClaim): Promise<CreateContactResult> {
    const [rows] = await this.pool.query<IdempotencyKeyRow[]>(
      'SELECT request_hash, contact_id FROM contact_idempotency_keys WHERE idempotency_key = ?',
      [claim.key],
    );
    const existing = rows[0];
    if (!existing || existing.request_hash !== claim.requestHash) {
      return { kind: 'conflict', reason: 'different_request' };
    }
    const contact = existing.contact_id === null ? null : await this.findById(existing.contact_id);
    if (!contact) {
      return { kind: 'conflict', reason: 'original_missing' };
    }
    return { kind: 'replayed', contact };
  }

  private async insertContact(
    connection: PoolConnection,
    input: CreateContactRequest,
  ): Promise<number> {
    const [result] = await connection.query<ResultSetHeader>(
      'INSERT INTO contact (class, quest, company, tel, num, last5, ticket, ticket_name, ticket_no, ticket_address, `from`, suggest_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
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
        'INSERT INTO contact_list (name, email, job, cel, cid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
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
