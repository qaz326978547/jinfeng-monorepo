import { z } from 'zod';

/**
 * Mirrors Laravel's Paginator::resolveCurrentPage(): `?page=` is read
 * loosely and falls back to 1 for anything that isn't a positive integer
 * (missing, non-numeric, zero, negative) — it is never a validation error.
 */
export const listContactQuestQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
});

export type ListContactQuestQuery = z.infer<typeof listContactQuestQuerySchema>;
