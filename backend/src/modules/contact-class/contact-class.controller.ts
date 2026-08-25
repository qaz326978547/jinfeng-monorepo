import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import type { ContactClassService } from './contact-class.service';

export function createListContactClassHandler(service: ContactClassService) {
  return asyncHandler(async (_req: Request, res: Response) => {
    const rows = await service.listActive();
    res.status(200).json(rows);
  });
}
