import { z } from 'zod';

/**
 * GET /api/v2/labor-news query params. Unlike pagination-query.schema.ts's page-only
 * `pageQuerySchema` (fixed server-side PER_PAGE), this endpoint's pageSize is caller-
 * controlled — the homepage asks for pageSize=5, the /labor-news list page asks for
 * pageSize=10 — so both hit the same public endpoint. `catch()` mirrors Laravel's loose
 * paginator behavior (already used by pageQuerySchema): an invalid value falls back to a
 * sane default instead of failing the request.
 */
export const laborNewsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(50).catch(10),
  keyword: z.string().trim().optional().default(''),
});

export type LaborNewsListQuery = z.infer<typeof laborNewsListQuerySchema>;
