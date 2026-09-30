import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import { buildRequestPath } from '../../shared/http/request-path';
import type { AdminConsultationStatusUpdateRequest } from './admin-consultation.schemas';
import type { AdminConsultationService } from './admin-consultation.service';

export function createAdminListConsultationHandler(service: AdminConsultationService) {
  return asyncHandler(async (req: Request, res: Response) => {
    // Coerced to a number by validateRequest's query schema (pageQuerySchema).
    const page = req.query.page as unknown as number;
    const envelope = await service.listPage({ page, path: buildRequestPath(req) });
    res.status(200).json(envelope);
  });
}

export function createAdminUpdateConsultationStatusHandler(service: AdminConsultationService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as unknown as number;
    const { status } = req.body as AdminConsultationStatusUpdateRequest;
    const consultation = await service.updateStatus(id, status);
    if (!consultation) {
      res.status(404).json({ message: '找不到資料' });
      return;
    }
    res.status(200).json({ message: '更新成功', data: consultation });
  });
}
