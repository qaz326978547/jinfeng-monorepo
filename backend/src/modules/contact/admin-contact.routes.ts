import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate-request';
import { deleteByIdsSchema } from '../../shared/http/delete-ids.schema';
import { pageQuerySchema } from '../../shared/http/pagination-query.schema';
import {
  createAdminDeleteContactHandler,
  createAdminGetContactHandler,
  createAdminListContactHandler,
  createAdminSearchContactHandler,
} from './admin-contact.controller';
import { adminContactIdParamsSchema, adminContactSearchQuerySchema } from './admin-contact.schemas';
import { AdminContactService } from './admin-contact.service';
import { ContactRepository } from './contact.repository';

export interface AdminContactRouterDeps {
  pool: Pool;
  jwtSecret: string;
}

export function createAdminContactRouter(deps: AdminContactRouterDeps): Router {
  const router = Router();
  router.use(authenticate(deps.jwtSecret), requireAdmin);

  const repository = new ContactRepository(deps.pool);
  const service = new AdminContactService(repository);

  router.get('/', validateRequest({ query: pageQuerySchema }), createAdminListContactHandler(service));
  router.delete('/', validateRequest({ body: deleteByIdsSchema }), createAdminDeleteContactHandler(service));
  // Must be registered before '/:id' so Express doesn't treat "search" as an id.
  router.get(
    '/search/search-company',
    validateRequest({ query: adminContactSearchQuerySchema }),
    createAdminSearchContactHandler(service),
  );
  router.get(
    '/:id',
    validateRequest({ params: adminContactIdParamsSchema }),
    createAdminGetContactHandler(service),
  );

  return router;
}
