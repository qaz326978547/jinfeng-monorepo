import { buildLaravelPagination, type LaravelPaginatedEnvelope } from '../../shared/http/laravel-pagination';
import type { LaborNews, LaborNewsRepository } from './labor-news.repository';
import type { LaborNewsWriteRequest } from './admin-labor-news.schemas';

const PER_PAGE = 10;

export class AdminLaborNewsService {
  constructor(private readonly repository: LaborNewsRepository) {}

  /** Admin sees active AND inactive rows, same sort_order/publishedAt/id ordering as public. */
  async listPage(params: { page: number; path: string }): Promise<LaravelPaginatedEnvelope<LaborNews>> {
    const total = await this.repository.countAllForAdmin();
    const offset = (params.page - 1) * PER_PAGE;
    const data = total === 0 ? [] : await this.repository.findPageForAdmin(PER_PAGE, offset);

    return buildLaravelPagination({
      data,
      total,
      currentPage: params.page,
      perPage: PER_PAGE,
      path: params.path,
    });
  }

  async create(input: LaborNewsWriteRequest): Promise<LaborNews> {
    return this.repository.create(input);
  }

  async update(id: number, input: LaborNewsWriteRequest): Promise<LaborNews | null> {
    return this.repository.update(id, input);
  }

  async deleteById(id: number): Promise<boolean> {
    return this.repository.deleteById(id);
  }
}
