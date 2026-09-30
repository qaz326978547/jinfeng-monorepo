import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import type { ConsultationService } from './consultation.service';
import type { CreateConsultationRequest } from './consultation.schemas';

export function createCreateConsultationHandler(service: ConsultationService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as CreateConsultationRequest;
    const consultation = await service.create(body);
    res.status(201).json({ message: '新增成功', data: consultation });
  });
}
