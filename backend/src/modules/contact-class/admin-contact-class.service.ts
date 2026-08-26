import type { ContactClassRepository, ContactClassRow } from './contact-class.repository';

export class AdminContactClassService {
  constructor(private readonly repository: ContactClassRepository) {}

  async getByIdActive(id: number): Promise<ContactClassRow | null> {
    return this.repository.findByIdActive(id);
  }
}
