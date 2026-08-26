import type {
  ContactClassRepository,
  ContactClassRow,
  DeleteByIdsResult,
} from './contact-class.repository';

export class AdminContactClassService {
  constructor(private readonly repository: ContactClassRepository) {}

  async getByIdActive(id: number): Promise<ContactClassRow | null> {
    return this.repository.findByIdActive(id);
  }

  async create(name: string, no: number): Promise<ContactClassRow> {
    return this.repository.create(name, no);
  }

  async updateActive(id: number, name: string, no: number): Promise<ContactClassRow | null> {
    return this.repository.updateActive(id, name, no);
  }

  async deleteByIds(ids: number[]): Promise<DeleteByIdsResult> {
    return this.repository.deleteByIds(ids);
  }
}
