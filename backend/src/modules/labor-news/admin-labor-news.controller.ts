import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import { buildRequestPath } from '../../shared/http/request-path';
import type { AdminLaborNewsService } from './admin-labor-news.service';
import type { LaborNewsWriteRequest } from './admin-labor-news.schemas';

export function createAdminListLaborNewsHandler(service: AdminLaborNewsService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page as unknown as number;
    const envelope = await service.listPage({ page, path: buildRequestPath(req) });
    res.status(200).json(envelope);
  });
}

export function createAdminCreateLaborNewsHandler(service: AdminLaborNewsService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const row = await service.create(req.body as LaborNewsWriteRequest);
    res.status(201).json({ message: '新增成功', data: row });
  });
}

export function createAdminUpdateLaborNewsHandler(service: AdminLaborNewsService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as unknown as number;
    const row = await service.update(id, req.body as LaborNewsWriteRequest);
    if (!row) {
      res.status(404).json({ message: '找不到資料' });
      return;
    }
    res.status(200).json({ message: '更新成功', data: row });
  });
}

export function createAdminDeleteLaborNewsHandler(service: AdminLaborNewsService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as unknown as number;
    const deleted = await service.deleteById(id);
    if (!deleted) {
      res.status(404).json({ message: '找不到資料' });
      return;
    }
    res.status(200).json({ message: '刪除成功' });
  });
}
