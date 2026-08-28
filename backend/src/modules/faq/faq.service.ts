import type { FaqRepository, FaqRow } from './faq.repository';

export class FaqService {
  constructor(private readonly repository: FaqRepository) {}

  /**
   * TODO(parity): restore FAQ 24-hour cache before production cutover.
   * Legacy behaviour: Laravel caches this query under key "faq" for 1440
   * minutes with no invalidation (see
   * specs/shared/api-contracts/api-business-logic.md #5 and
   * specs/backend/laravel-to-node-parity.md). This phase intentionally
   * implements query/response parity only — every call hits the database.
   */
  async listAll(): Promise<FaqRow[]> {
    return this.repository.findAllProjected();
  }
}
