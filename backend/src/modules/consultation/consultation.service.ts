import type { ConsultationMailService } from '../../infrastructure/mail/mail.service';
import type { Consultation, ConsultationRepository } from './consultation.repository';
import type { CreateConsultationRequest } from './consultation.schemas';

export class ConsultationService {
  constructor(
    private readonly repository: ConsultationRepository,
    private readonly mailService: ConsultationMailService,
  ) {}

  /**
   * DB write happens first and is the source of truth: mail is sent only
   * after the insert commits, and a mail failure never rolls back or fails
   * this call — same policy as ContactService.createContact.
   */
  async create(input: CreateConsultationRequest): Promise<Consultation> {
    const consultation = await this.repository.create({
      name: input.name,
      phone: input.phone,
      companyName: input.companyName ?? null,
      taxId: input.taxId ?? null,
      lineId: input.lineId ?? null,
      callbackTimes: input.callbackTimes,
      message: input.message ?? null,
    });
    await this.mailService.sendConsultationNotification(consultation);
    return consultation;
  }
}
