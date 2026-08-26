import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate-request';
import { createAdminGetContactClassHandler } from './admin-contact-class.controller';
import { adminContactClassIdParamsSchema } from './admin-contact-class.schemas';
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

  router.get(
    '/:id',
    validateRequest({ params: adminContactClassIdParamsSchema }),
    createAdminGetContactClassHandler(service),
  );

  return router;
}
