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
  // Coerced (not a plain z.number()): the admin frontend's `no` field is a
  // plain <input type="text"> bound with v-model (not v-model.number), so it
  // always submits a string (e.g. "66") over the wire regardless of its ref's
  // `number` TS type — a real production bug where PUT/POST always 400'd
  // with "no 為必填欄位" even on a fully filled-in form. z.coerce.number()
  // accepts both a numeric string and an actual number; a genuinely
  // non-numeric string (e.g. "abc") still fails the coercion -> still 400.
  no: z.coerce.number({ error: 'no 為必填欄位' }).int('no 必須為整數'),
});

export type ContactClassWriteRequest = z.infer<typeof contactClassWriteRequestSchema>;
