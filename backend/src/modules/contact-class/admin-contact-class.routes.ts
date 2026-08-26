import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate-request';
import { deleteByIdsSchema } from '../../shared/http/delete-ids.schema';
import {
  createAdminCreateContactClassHandler,
  createAdminDeleteContactClassHandler,
  createAdminGetContactClassHandler,
  createAdminUpdateContactClassHandler,
} from './admin-contact-class.controller';
import {
  adminContactClassIdParamsSchema,
  contactClassWriteRequestSchema,
} from './admin-contact-class.schemas';
import { AdminContactClassService } from './admin-contact-class.service';
import { ContactClassRepository } from './contact-class.repository';

export interface AdminContactClassRouterDeps {
  pool: Pool;
  jwtSecret: string;
}

export function createAdminContactClassRouter(deps: AdminContactClassRouterDeps): Router {
  const router = Router();
  router.use(authenticate(deps.jwtSecret), requireAdmin);

  const repository = new ContactClassRepository(deps.pool);
  const service = new AdminContactClassService(repository);

  // Note: there is no GET /admin/contact-class (index) in the legacy
  // contract — only GET /admin/contact-class/{id}, mounted below.
  router.post(
    '/',
    validateRequest({ body: contactClassWriteRequestSchema, formRequestErrorFormat: true }),
    createAdminCreateContactClassHandler(service),
  );
  router.delete(
    '/',
    validateRequest({ body: deleteByIdsSchema }),
    createAdminDeleteContactClassHandler(service),
  );
  router.get(
    '/:id',
    validateRequest({ params: adminContactClassIdParamsSchema }),
    createAdminGetContactClassHandler(service),
  );
  router.put(
    '/:id',
    validateRequest({
      params: adminContactClassIdParamsSchema,
      body: contactClassWriteRequestSchema,
      formRequestErrorFormat: true,
    }),
    createAdminUpdateContactClassHandler(service),
  );

  return router;
}
