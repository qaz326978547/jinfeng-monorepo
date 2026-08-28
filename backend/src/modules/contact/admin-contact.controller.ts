import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import { buildRequestPath } from '../../shared/http/request-path';
import type { AdminContactService } from './admin-contact.service';

export function createAdminListContactHandler(service: AdminContactService) {
  return asyncHandler(async (req: Request, res: Response) => {
    // Coerced to a number by validateRequest's query schema (admin-contact.schemas.ts).
    const page = req.query.page as unknown as number;
    const envelope = await service.listPage({ page, path: buildRequestPath(req) });
    res.status(200).json(envelope);
  });
}

export function createAdminGetContactHandler(service: AdminContactService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as unknown as number;
    const contact = await service.getById(id);
    if (!contact) {
      // Legacy-compatible 404 shape (api-specification.md #10): {message}
      // only — no code/requestId envelope.
      res.status(404).json({ message: '找不到資料' });
      return;
    }
    res.status(200).json(contact);
  });
}

export function createAdminSearchContactHandler(service: AdminContactService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page as unknown as number;
    const company = req.query.company as unknown as string;
    const envelope = await service.searchByCompany({ company, page, path: buildRequestPath(req) });
    res.status(200).json(envelope);
  });
}

export function createAdminDeleteContactHandler(service: AdminContactService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const idsInput = (req.body as { ids: number | number[] }).ids;
    const idsArray = Array.isArray(idsInput) ? idsInput : [idsInput];
    const result = await service.deleteByIds(idsArray);

    if (result.missingIds.length > 0) {
      // api-specification.md #12: array mode lists every missing id,
      // single-value mode names just that one id.
      const message = Array.isArray(idsInput)
        ? `以下的 id 不存在: ${result.missingIds.join(', ')}`
        : `找不到 id: ${result.missingIds[0]}`;
      res.status(404).json({ message });
      return;
    }

    res.status(200).json({ message: '刪除成功' });
  });
}
