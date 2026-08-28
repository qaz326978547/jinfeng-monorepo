import { z } from 'zod';

export const contactListIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
