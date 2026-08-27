import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate-request';
import { deleteByIdsSchema } from '../../shared/http/delete-ids.schema';
import {
  createAdminCreateFaqHandler,
  createAdminDeleteFaqHandler,
  createAdminListFaqHandler,
  createAdminUpdateFaqHandler,
} from './admin-faq.controller';
import { adminFaqIdParamsSchema, faqWriteRequestSchema } from './admin-faq.schemas';
import { AdminFaqService } from './admin-faq.service';
import { FaqRepository } from './faq.repository';

export interface AdminFaqRouterDeps {
  pool: Pool;
  jwtSecret: string;
}

export function createAdminFaqRouter(deps: AdminFaqRouterDeps): Router {
  const router = Router();
  router.use(authenticate(deps.jwtSecret), requireAdmin);

  const repository = new FaqRepository(deps.pool);
  const service = new AdminFaqService(repository);

  router.get('/', createAdminListFaqHandler(service));
  router.post(
    '/',
    validateRequest({ body: faqWriteRequestSchema, formRequestErrorFormat: true }),
    createAdminCreateFaqHandler(service),
  );
  router.delete('/', validateRequest({ body: deleteByIdsSchema }), createAdminDeleteFaqHandler(service));
  router.put(
    '/:id',
    validateRequest({
      params: adminFaqIdParamsSchema,
      body: faqWriteRequestSchema,
      formRequestErrorFormat: true,
    }),
    createAdminUpdateFaqHandler(service),
  );

  return router;
}
