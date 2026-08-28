import { z } from 'zod';

// Mirrors specs/shared/api-contracts/openapi.yaml components.schemas.LoginRequest.
// .strict() rejects any field beyond email/password (FR-001) — violations
// surface as a Zod `unrecognized_keys` issue, converted to the Laravel-
// compatible 422 shape by legacyErrorFormat on this route (see auth.routes.ts).
export const loginRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Mirrors specs/shared/api-contracts/openapi.yaml components.schemas.RegisterRequest.
// Field order matches api-specification.md #7's validation table, which
// determines which message firstValidationMessage() (used by this route's
// formRequestErrorFormat) surfaces first — see contact.schemas.ts for the
// same convention and the note on why required strings use
// `z.string({error})` instead of relying on `.min()` alone.
export const registerRequestSchema = z
  .object({
    name: z.string({ error: 'name 為必填欄位' }).min(1, 'name 為必填欄位'),
    email: z.string({ error: 'email 為必填欄位' }).email('email 格式不正確'),
    password: z.string({ error: 'password 為必填欄位' }).min(6, 'password 至少需要 6 個字元'),
    password_confirmation: z
      .string({ error: 'password_confirmation 為必填欄位' })
      .min(1, 'password_confirmation 為必填欄位'),
    is_admin: z.boolean().optional(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'password_confirmation 與 password 不一致',
    path: ['password_confirmation'],
  });
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
