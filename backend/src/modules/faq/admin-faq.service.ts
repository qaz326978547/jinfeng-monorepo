import type { DeleteByIdsResult, FaqRepository, FaqRow } from './faq.repository';

export class AdminFaqService {
  constructor(private readonly repository: FaqRepository) {}

  async listAll(): Promise<FaqRow[]> {
    return this.repository.findAllForAdmin();
  }

  async create(name: string, info: string, no: number): Promise<FaqRow> {
    return this.repository.create(name, info, no);
  }

  async update(id: number, name: string, info: string, no: number): Promise<FaqRow | null> {
    return this.repository.update(id, name, info, no);
  }

  async deleteByIds(ids: number[]): Promise<DeleteByIdsResult> {
    return this.repository.deleteByIds(ids);
  }
}
