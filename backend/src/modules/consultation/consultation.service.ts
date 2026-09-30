import type { Consultation, ConsultationRepository } from './consultation.repository';
import type { CreateConsultationRequest } from './consultation.schemas';

export class ConsultationService {
  constructor(private readonly repository: ConsultationRepository) {}

  async create(input: CreateConsultationRequest): Promise<Consultation> {
    return this.repository.create({
      name: input.name,
      phone: input.phone,
      companyName: input.companyName ?? null,
      taxId: input.taxId ?? null,
      lineId: input.lineId ?? null,
      callbackTimes: input.callbackTimes,
      message: input.message ?? null,
    });
  }
}
