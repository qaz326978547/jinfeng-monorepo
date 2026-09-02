import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { validateRequest } from '../../middleware/validate-request';
import { createListLaborNewsHandler } from './labor-news.controller';
import { laborNewsListQuerySchema } from './labor-news.schemas';
import { LaborNewsRepository } from './labor-news.repository';
import { LaborNewsService } from './labor-news.service';

export interface LaborNewsRouterDeps {
  pool: Pool;
}

export function createLaborNewsRouter(deps: LaborNewsRouterDeps): Router {
  const router = Router();
  const repository = new LaborNewsRepository(deps.pool);
  const service = new LaborNewsService(repository);

  router.get('/', validateRequest({ query: laborNewsListQuerySchema }), createListLaborNewsHandler(service));

  return router;
}
