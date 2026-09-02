import { buildLaravelPagination, type LaravelPaginatedEnvelope } from '../../shared/http/laravel-pagination';
import type { LaborNewsRepository, PublicLaborNews } from './labor-news.repository';

export interface ListActiveLaborNewsParams {
  page: number;
  pageSize: number;
  keyword: string;
  path: string;
}

export class LaborNewsService {
  constructor(private readonly repository: LaborNewsRepository) {}

  async listActive(params: ListActiveLaborNewsParams): Promise<LaravelPaginatedEnvelope<PublicLaborNews>> {
    const keyword = params.keyword.trim();
    const total = await this.repository.countActive(keyword);
    const offset = (params.page - 1) * params.pageSize;
    const data = total === 0 ? [] : await this.repository.findActivePage(params.pageSize, offset, keyword);

    return buildLaravelPagination({
      data,
      total,
      currentPage: params.page,
      perPage: params.pageSize,
      path: params.path,
    });
  }
}
