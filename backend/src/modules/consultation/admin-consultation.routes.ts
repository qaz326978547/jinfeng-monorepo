import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate-request';
import { pageQuerySchema } from '../../shared/http/pagination-query.schema';
import {
  createAdminListConsultationHandler,
  createAdminUpdateConsultationStatusHandler,
} from './admin-consultation.controller';
import {
  adminConsultationIdParamsSchema,
  adminConsultationStatusUpdateSchema,
} from './admin-consultation.schemas';
import { AdminConsultationService } from './admin-consultation.service';
import { ConsultationRepository } from './consultation.repository';

export interface AdminConsultationRouterDeps {
  pool: Pool;
  jwtSecret: string;
}

export function createAdminConsultationRouter(deps: AdminConsultationRouterDeps): Router {
  const router = Router();
  router.use(authenticate(deps.jwtSecret), requireAdmin);

  const repository = new ConsultationRepository(deps.pool);
  const service = new AdminConsultationService(repository);

  router.get('/', validateRequest({ query: pageQuerySchema }), createAdminListConsultationHandler(service));
  router.patch(
    '/:id',
    validateRequest({
      params: adminConsultationIdParamsSchema,
      body: adminConsultationStatusUpdateSchema,
      formRequestErrorFormat: true,
    }),
    createAdminUpdateConsultationStatusHandler(service),
  );

  return router;
}
