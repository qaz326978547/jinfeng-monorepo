import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AdminCarouselService } from './admin-carousel.service';
import type { CarouselWriteRequest, UploadUrlRequest } from './admin-carousel.schemas';

export function createAdminListCarouselHandler(service: AdminCarouselService) {
  return asyncHandler(async (_req: Request, res: Response) => {
    const rows = await service.listAll();
    res.status(200).json({ data: rows });
  });
}

export function createAdminCreateCarouselHandler(service: AdminCarouselService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const row = await service.create(req.body as CarouselWriteRequest);
    res.status(201).json({ message: '新增成功', data: row });
  });
}

export function createAdminUpdateCarouselHandler(service: AdminCarouselService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as unknown as number;
    const row = await service.update(id, req.body as CarouselWriteRequest);
    if (!row) {
      res.status(404).json({ message: '找不到資料' });
      return;
    }
    res.status(200).json({ message: '更新成功', data: row });
  });
}

export function createAdminDeleteCarouselHandler(service: AdminCarouselService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as unknown as number;
    const result = await service.deleteById(id);
    if (result === 'not_found') {
      res.status(404).json({ message: '找不到資料' });
      return;
    }
    res.status(200).json({ message: '刪除成功' });
  });
}

export function createAdminCarouselUploadUrlHandler(service: AdminCarouselService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const result = await service.createUploadUrl(req.body as UploadUrlRequest);
    res.status(200).json(result);
  });
}
