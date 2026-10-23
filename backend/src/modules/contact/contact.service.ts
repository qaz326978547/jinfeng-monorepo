import { createHash } from 'node:crypto';
import type { Logger } from 'pino';
import type {
  ContactMailService,
  NotificationStatus,
} from '../../infrastructure/mail/mail.service';
import { AppError } from '../../shared/errors/app-error';
import type { ContactRepository, ContactRow } from './contact.repository';
import type { CreateContactRequest } from './contact.schemas';

export interface CreateContactOutcome {
  contact: ContactRow;
  /**
   * Staff notification email for THIS request. Always "skipped" on a replay —
   * the email belongs to the original request and is never sent twice.
   */
  notification: NotificationStatus;
  /** true when an earlier request with the same Idempotency-Key already saved it. */
  replayed: boolean;
}

export class IdempotencyConflictError extends AppError {
  constructor(message: string) {
    super(409, 'IDEMPOTENCY_KEY_CONFLICT', message);
  }
}

/** Key-order-independent JSON, so the hash only changes when the data does. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashContactRequest(input: CreateContactRequest): string {
  return createHash('sha256').update(canonicalJson(input)).digest('hex');
}

export class ContactService {
  constructor(
    private readonly repository: ContactRepository,
    private readonly mailService: ContactMailService,
    private readonly logger: Logger,
  ) {}

  /**
   * DB write happens first and is the source of truth: mail is sent only
   * after the transaction commits, and a mail failure never rolls back or
   * fails this call — the outcome just reports `notification: "failed"`.
   */
  async createContact(
    input: CreateContactRequest,
    idempotencyKey?: string,
  ): Promise<CreateContactOutcome> {
    const result = await this.repository.createWithContactList(
      input,
      idempotencyKey === undefined
        ? undefined
        : { key: idempotencyKey, requestHash: hashContactRequest(input) },
    );

    if (result.kind === 'conflict') {
      throw new IdempotencyConflictError(
        result.reason === 'different_request'
          ? '這個報名識別碼已用於另一筆不同內容的報名，請重新整理頁面後再送出'
          : '這筆報名先前已送出，但原報名資料已被刪除，請重新整理頁面後再送出',
      );
    }

    if (result.kind === 'replayed') {
      this.logger.info(
        { code: 'CONTACT_IDEMPOTENT_REPLAY', contactId: result.contact.id },
        'Duplicate contact submission answered from the original registration',
      );
      return { contact: result.contact, notification: 'skipped', replayed: true };
    }

    if (!result.deduplicated) {
      this.logger.warn(
        { code: 'CONTACT_IDEMPOTENCY_UNAVAILABLE', contactId: result.contact.id },
        'contact_idempotency_keys table missing (migration 008 not applied); saved without duplicate protection',
      );
    }

    const notification = await this.mailService.sendContactNotification(result.contact);
    return { contact: result.contact, notification, replayed: false };
  }
}
