import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { createListContactClassHandler } from './contact-class.controller';
import { ContactClassRepository } from './contact-class.repository';
import { ContactClassService } from './contact-class.service';

export interface ContactClassRouterDeps {
  pool: Pool;
}

export function createContactClassRouter(deps: ContactClassRouterDeps): Router {
  const router = Router();
  const repository = new ContactClassRepository(deps.pool);
  const service = new ContactClassService(repository);

  router.get('/', createListContactClassHandler(service));

  return router;
}
