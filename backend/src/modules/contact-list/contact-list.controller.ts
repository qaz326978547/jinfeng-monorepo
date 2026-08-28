import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import type { ContactListService } from './contact-list.service';

export function createListContactListHandler(service: ContactListService) {
  return asyncHandler(async (_req: Request, res: Response) => {
    const rows = await service.listAll();
    res.status(200).json({ data: rows });
  });
}

export function createGetContactListHandler(service: ContactListService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as unknown as number;
    const row = await service.getById(id);
    if (!row) {
      // Legacy-compatible 404 shape (api-specification.md #14): {message}
      // only — no code/requestId envelope.
      res.status(404).json({ message: '找不到資料' });
      return;
    }
    res.status(200).json(row);
  });
}
