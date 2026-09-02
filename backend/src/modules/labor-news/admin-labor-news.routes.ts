import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate-request';
import {
  createAdminCreateLaborNewsHandler,
  createAdminDeleteLaborNewsHandler,
  createAdminListLaborNewsHandler,
  createAdminUpdateLaborNewsHandler,
} from './admin-labor-news.controller';
import {
  adminLaborNewsIdParamsSchema,
  adminLaborNewsListQuerySchema,
  laborNewsWriteRequestSchema,
} from './admin-labor-news.schemas';
import { AdminLaborNewsService } from './admin-labor-news.service';
import { LaborNewsRepository } from './labor-news.repository';

export interface AdminLaborNewsRouterDeps {
  pool: Pool;
  jwtSecret: string;
}

export function createAdminLaborNewsRouter(deps: AdminLaborNewsRouterDeps): Router {
  const router = Router();
  router.use(authenticate(deps.jwtSecret), requireAdmin);

  const repository = new LaborNewsRepository(deps.pool);
  const service = new AdminLaborNewsService(repository);

  router.get(
    '/',
    validateRequest({ query: adminLaborNewsListQuerySchema }),
    createAdminListLaborNewsHandler(service),
  );
  router.post(
    '/',
    validateRequest({ body: laborNewsWriteRequestSchema, formRequestErrorFormat: true }),
    createAdminCreateLaborNewsHandler(service),
  );
  router.put(
    '/:id',
    validateRequest({
      params: adminLaborNewsIdParamsSchema,
      body: laborNewsWriteRequestSchema,
      formRequestErrorFormat: true,
    }),
    createAdminUpdateLaborNewsHandler(service),
  );
  router.delete(
    '/:id',
    validateRequest({ params: adminLaborNewsIdParamsSchema }),
    createAdminDeleteLaborNewsHandler(service),
  );

  return router;
}
