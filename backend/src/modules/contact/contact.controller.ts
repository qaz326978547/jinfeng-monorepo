import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import { FormRequestValidationError } from '../../shared/errors/form-request-validation-error';
import type { ContactService } from './contact.service';
import { idempotencyKeySchema, type CreateContactRequest } from './contact.schemas';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

export function createCreateContactHandler(service: ContactService) {
  return asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as CreateContactRequest;

    const rawKey = req.get(IDEMPOTENCY_KEY_HEADER);
    let idempotencyKey: string | undefined;
    if (rawKey !== undefined) {
      const parsed = idempotencyKeySchema.safeParse(rawKey);
      if (!parsed.success) {
        throw new FormRequestValidationError(
          parsed.error.issues[0]?.message ?? 'Validation failed',
        );
      }
      idempotencyKey = parsed.data;
    }

    const { contact, notification, replayed } = await service.createContact(body, idempotencyKey);

    if (replayed) {
      res.set('Idempotent-Replayed', 'true');
    }
    // Always 201 + "新增成功" once the registration is saved — whether the
    // staff email went out (`notification`) or this was a replay — so the
    // client never treats a saved registration as a failure and re-submits.
    res.status(201).json({ message: '新增成功', data: contact, notification, replayed });
  });
}
