import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { validateRequest } from '../../middleware/validate-request';
import { createListContactQuestHandler } from './contact-quest.controller';
import { ContactQuestRepository } from './contact-quest.repository';
import { listContactQuestQuerySchema } from './contact-quest.schemas';
import { ContactQuestService } from './contact-quest.service';

export interface ContactQuestRouterDeps {
  pool: Pool;
}

export function createContactQuestRouter(deps: ContactQuestRouterDeps): Router {
  const router = Router();
  const repository = new ContactQuestRepository(deps.pool);
  const service = new ContactQuestService(repository);

  router.get(
    '/',
    validateRequest({ query: listContactQuestQuerySchema }),
    createListContactQuestHandler(service),
  );

  return router;
}
