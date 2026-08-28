import { z } from 'zod';
import { pageQuerySchema } from '../../shared/http/pagination-query.schema';

export const adminContactIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** `company` mirrors Laravel's optional, possibly-empty query string (api-specification.md #19). */
export const adminContactSearchQuerySchema = pageQuerySchema.extend({
  company: z.string().optional().default(''),
});
