import type { ContactMailService } from '../../infrastructure/mail/mail.service';
import type { ContactRepository, ContactRow } from './contact.repository';
import type { CreateContactRequest } from './contact.schemas';

export class ContactService {
  constructor(
    private readonly repository: ContactRepository,
    private readonly mailService: ContactMailService,
  ) {}

  /**
   * DB write happens first and is the source of truth: mail is sent only
   * after the transaction commits, and a mail failure never rolls back or
   * fails this call — see ContactMailService for the full policy.
   */
  async createContact(input: CreateContactRequest): Promise<ContactRow> {
    const contact = await this.repository.createWithContactList(input);
    await this.mailService.sendContactNotification(contact);
    return contact;
  }
}
