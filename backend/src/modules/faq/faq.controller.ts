import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import type { FaqService } from './faq.service';

export function createListFaqHandler(service: FaqService) {
  return asyncHandler(async (_req: Request, res: Response) => {
    const rows = await service.listAll();
    res.status(200).json(rows);
  });
}
