import type { ContactListRepository, ContactListRow } from './contact-list.repository';

export class ContactListService {
  constructor(private readonly repository: ContactListRepository) {}

  async listAll(): Promise<ContactListRow[]> {
    return this.repository.findAll();
  }

  async getById(id: number): Promise<ContactListRow | null> {
    return this.repository.findById(id);
  }
}
