import { z } from 'zod';

export const adminContactClassIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * Shared by POST /admin/contact-class and PUT /admin/contact-class/{id} —
 * api-specification.md documents identical validation rules for both
 * (`name` required string, `no` required integer), and this is the one
 * update endpoint the spec explicitly confirms has no mismatch between
 * validation and actual write fields (contrast with #11, PUT
 * /admin/contact/{id}, which is deliberately NOT implemented for exactly
 * that reason).
 */
export const contactClassWriteRequestSchema = z.object({
  name: z.string({ error: 'name 為必填欄位' }).min(1, 'name 為必填欄位'),
  no: z.number({ error: 'no 為必填欄位' }).int('no 必須為整數'),
});

export type ContactClassWriteRequest = z.infer<typeof contactClassWriteRequestSchema>;
