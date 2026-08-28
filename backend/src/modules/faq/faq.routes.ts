import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { createListFaqHandler } from './faq.controller';
import { FaqRepository } from './faq.repository';
import { FaqService } from './faq.service';

export interface FaqRouterDeps {
  pool: Pool;
}

export function createFaqRouter(deps: FaqRouterDeps): Router {
  const router = Router();
  const repository = new FaqRepository(deps.pool);
  const service = new FaqService(repository);

  router.get('/', createListFaqHandler(service));

  return router;
}
