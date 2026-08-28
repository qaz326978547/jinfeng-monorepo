import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import type { ContactClassWriteRequest } from './admin-contact-class.schemas';
import type { AdminContactClassService } from './admin-contact-class.service';

export function createAdminGetContactClassHandler(service: AdminContactClassService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as unknown as number;
    const row = await service.getByIdActive(id);
    if (!row) {
      // Legacy-compatible 404 shape (api-specification.md #15): {message}
      // only — no code/requestId envelope. Covers both "no such row" and
      // "row exists but del=1" (findByIdActive filters both the same way).
      res.status(404).json({ message: '找不到資料' });
      return;
    }
    res.status(200).json(row);
  });
}

export function createAdminCreateContactClassHandler(service: AdminContactClassService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const { name, no } = req.body as ContactClassWriteRequest;
    const row = await service.create(name, no);
    res.status(201).json({ message: '新增成功', data: row });
  });
}

export function createAdminUpdateContactClassHandler(service: AdminContactClassService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as unknown as number;
    const { name, no } = req.body as ContactClassWriteRequest;
    const row = await service.updateActive(id, name, no);
    if (!row) {
      res.status(404).json({ message: '找不到資料' });
      return;
    }
    res.status(200).json({ message: '更新成功', data: row });
  });
}

export function createAdminDeleteContactClassHandler(service: AdminContactClassService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const idsInput = (req.body as { ids: number | number[] }).ids;
    const idsArray = Array.isArray(idsInput) ? idsInput : [idsInput];
    const result = await service.deleteByIds(idsArray);

    if (result.missingIds.length > 0) {
      // api-specification.md #18 (same pattern as #12): array mode lists
      // every missing id, single-value mode names just that one id.
      const message = Array.isArray(idsInput)
        ? `以下的 id 不存在: ${result.missingIds.join(', ')}`
        : `找不到 id: ${result.missingIds[0]}`;
      res.status(404).json({ message });
      return;
    }

    res.status(200).json({ message: '刪除成功' });
  });
}
