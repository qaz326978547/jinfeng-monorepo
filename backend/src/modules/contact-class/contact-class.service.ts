import type { ContactClassRepository, ContactClassRow } from './contact-class.repository';

export class ContactClassService {
  constructor(private readonly repository: ContactClassRepository) {}

  async listActive(): Promise<ContactClassRow[]> {
    return this.repository.findAllActive();
  }
}
