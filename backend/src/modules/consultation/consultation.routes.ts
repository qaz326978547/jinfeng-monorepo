import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { validateRequest } from '../../middleware/validate-request';
import { createInMemoryRateLimiter } from '../../middleware/rate-limit';
import { createCreateConsultationHandler } from './consultation.controller';
import { ConsultationRepository } from './consultation.repository';
import { createConsultationRequestSchema } from './consultation.schemas';
import { ConsultationService } from './consultation.service';

export interface ConsultationRouterDeps {
  pool: Pool;
}

export function createConsultationRouter(deps: ConsultationRouterDeps): Router {
  const router = Router();

  const repository = new ConsultationRepository(deps.pool);
  const service = new ConsultationService(repository);

  // 5 submissions / 10 minutes / IP — generous for a real visitor, painful for
  // a script. Created per router instance (not module-scoped) so its
  // in-memory state does not leak across the process's lifetime beyond this
  // one mounted route. Scoped to just this route; never applied globally
  // (see middleware/rate-limit.ts).
  const consultationRateLimiter = createInMemoryRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });

  router.post(
    '/',
    consultationRateLimiter,
    validateRequest({ body: createConsultationRequestSchema, formRequestErrorFormat: true }),
    createCreateConsultationHandler(service),
  );

  return router;
}
