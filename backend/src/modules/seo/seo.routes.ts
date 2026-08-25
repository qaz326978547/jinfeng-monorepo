import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { createListSeoHandler } from './seo.controller';
import { SeoRepository } from './seo.repository';
import { SeoService } from './seo.service';

export interface SeoRouterDeps {
  pool: Pool;
}

export function createSeoRouter(deps: SeoRouterDeps): Router {
  const router = Router();
  const repository = new SeoRepository(deps.pool);
  const service = new SeoService(repository);

  router.get('/', createListSeoHandler(service));

  return router;
}
