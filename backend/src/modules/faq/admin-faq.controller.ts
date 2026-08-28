import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AdminFaqService } from './admin-faq.service';
import type { FaqWriteRequest } from './admin-faq.schemas';

export function createAdminListFaqHandler(service: AdminFaqService) {
  return asyncHandler(async (_req: Request, res: Response) => {
    const rows = await service.listAll();
    res.status(200).json({ data: rows });
  });
}

export function createAdminCreateFaqHandler(service: AdminFaqService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const { name, info, no } = req.body as FaqWriteRequest;
    const row = await service.create(name, info, no);
    res.status(201).json({ message: '新增成功', data: row });
  });
}

export function createAdminUpdateFaqHandler(service: AdminFaqService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as unknown as number;
    const { name, info, no } = req.body as FaqWriteRequest;
    const row = await service.update(id, name, info, no);
    if (!row) {
      res.status(404).json({ message: '找不到資料' });
      return;
    }
    res.status(200).json({ message: '更新成功', data: row });
  });
}

export function createAdminDeleteFaqHandler(service: AdminFaqService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const idsInput = (req.body as { ids: number | number[] }).ids;
    const idsArray = Array.isArray(idsInput) ? idsInput : [idsInput];
    const result = await service.deleteByIds(idsArray);

    if (result.missingIds.length > 0) {
      const message = Array.isArray(idsInput)
        ? `以下的 id 不存在: ${result.missingIds.join(', ')}`
        : `找不到 id: ${result.missingIds[0]}`;
      res.status(404).json({ message });
      return;
    }

    res.status(200).json({ message: '刪除成功' });
  });
}
