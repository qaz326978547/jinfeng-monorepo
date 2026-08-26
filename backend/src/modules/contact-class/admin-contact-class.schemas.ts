import { z } from 'zod';

export const adminContactClassIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
