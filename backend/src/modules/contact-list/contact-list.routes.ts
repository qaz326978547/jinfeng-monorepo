import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate-request';
import { createGetContactListHandler, createListContactListHandler } from './contact-list.controller';
import { ContactListRepository } from './contact-list.repository';
import { contactListIdParamsSchema } from './contact-list.schemas';
import { ContactListService } from './contact-list.service';

export interface ContactListRouterDeps {
  pool: Pool;
  jwtSecret: string;
}

/**
 * Admin-only in this codebase (there is no public GET /contact-list in the
 * legacy contract). authenticate + requireAdmin are mounted here, not in
 * repository/service — see specs/backend/laravel-to-node-parity.md §10.13.
 */
export function createContactListRouter(deps: ContactListRouterDeps): Router {
  const router = Router();
  router.use(authenticate(deps.jwtSecret), requireAdmin);

  const repository = new ContactListRepository(deps.pool);
  const service = new ContactListService(repository);

  router.get('/', createListContactListHandler(service));
  router.get(
    '/:id',
    validateRequest({ params: contactListIdParamsSchema }),
    createGetContactListHandler(service),
  );

  return router;
}
