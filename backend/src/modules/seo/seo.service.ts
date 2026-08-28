import type { SeoRepository, SeoRow } from './seo.repository';

export class SeoService {
  constructor(private readonly repository: SeoRepository) {}

  async listAll(): Promise<SeoRow[]> {
    return this.repository.findAll();
  }
}
