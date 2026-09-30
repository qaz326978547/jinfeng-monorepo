import { z } from 'zod';

export const adminConsultationIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const adminConsultationStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'contacted', 'completed'], {
    error: 'status 必須為 pending、contacted 或 completed',
  }),
});

export type AdminConsultationStatusUpdateRequest = z.infer<typeof adminConsultationStatusUpdateSchema>;
