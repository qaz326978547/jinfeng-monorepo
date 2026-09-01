import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import type { CarouselService } from './carousel.service';

export function createListCarouselHandler(service: CarouselService) {
  return asyncHandler(async (_req: Request, res: Response) => {
    const rows = await service.listActive();
    res.status(200).json(rows);
  });
}
