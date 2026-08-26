import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
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
