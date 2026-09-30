import {
  buildLaravelPagination,
  type LaravelPaginatedEnvelope,
} from '../../shared/http/laravel-pagination';
import type { Consultation, ConsultationRepository, ConsultationStatus } from './consultation.repository';

const PER_PAGE = 10;

export class AdminConsultationService {
  constructor(private readonly repository: ConsultationRepository) {}

  async listPage(params: { page: number; path: string }): Promise<LaravelPaginatedEnvelope<Consultation>> {
    const total = await this.repository.countAll();
    const offset = (params.page - 1) * PER_PAGE;
    const data = total === 0 ? [] : await this.repository.findPage(PER_PAGE, offset);

    return buildLaravelPagination({
      data,
      total,
      currentPage: params.page,
      perPage: PER_PAGE,
      path: params.path,
    });
  }

  async updateStatus(id: number, status: ConsultationStatus): Promise<Consultation | null> {
    return this.repository.updateStatus(id, status);
  }
}
