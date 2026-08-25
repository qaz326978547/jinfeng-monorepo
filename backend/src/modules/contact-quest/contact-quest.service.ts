import {
  buildLaravelPagination,
  type LaravelPaginatedEnvelope,
} from '../../shared/http/laravel-pagination';
import type { ContactQuestRepository, ContactQuestRow } from './contact-quest.repository';

const PER_PAGE = 10;

export interface ListContactQuestParams {
  page: number;
  /** Full URL of the current request, excluding the query string. */
  path: string;
}

export class ContactQuestService {
  constructor(private readonly repository: ContactQuestRepository) {}

  async listPage(
    params: ListContactQuestParams,
  ): Promise<LaravelPaginatedEnvelope<ContactQuestRow>> {
    const total = await this.repository.countActive();
    const offset = (params.page - 1) * PER_PAGE;
    const data = total === 0 ? [] : await this.repository.findPageActive(PER_PAGE, offset);

    return buildLaravelPagination({
      data,
      total,
      currentPage: params.page,
      perPage: PER_PAGE,
      path: params.path,
    });
  }
}
