import { z } from 'zod';

/**
 * Mirrors Laravel's Paginator::resolveCurrentPage(): `?page=` is read
 * loosely and falls back to 1 for anything that isn't a positive integer
 * (missing, non-numeric, zero, negative) — it is never a validation error.
 * Same rule as modules/contact-quest/contact-quest.schemas.ts; extracted
 * here so new admin endpoints needing `?page=` don't each redefine it.
 */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
});
