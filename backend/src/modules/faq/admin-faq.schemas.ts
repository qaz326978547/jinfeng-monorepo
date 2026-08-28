import { z } from 'zod';

export const adminFaqIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * Shared by POST /admin/faq and PUT /admin/faq/{id}. There is no confirmed
 * legacy FAQ admin contract (this is a new Node/Admin feature — see
 * specs/backend/laravel-to-node-parity.md), so validation rules mirror the
 * confirmed contact-class pattern: name/info required strings, no required
 * integer.
 */
export const faqWriteRequestSchema = z.object({
  name: z.string({ error: 'name 為必填欄位' }).min(1, 'name 為必填欄位'),
  info: z.string({ error: 'info 為必填欄位' }).min(1, 'info 為必填欄位'),
  no: z.number({ error: 'no 為必填欄位' }).int('no 必須為整數'),
});

export type FaqWriteRequest = z.infer<typeof faqWriteRequestSchema>;
