import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import type { ContactService } from './contact.service';
import type { CreateContactRequest } from './contact.schemas';

export function createCreateContactHandler(service: ContactService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as CreateContactRequest;
    const contact = await service.createContact(body);
    res.status(201).json({ message: '新增成功', data: contact });
  });
}
