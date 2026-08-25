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

// Mirrors specs/shared/api-contracts/openapi.yaml components.schemas.RegisterRequest
export const registerRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  password_confirmation: z.string().min(6),
  is_admin: z.boolean().optional(),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
