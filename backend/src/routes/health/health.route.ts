import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { getHealth } from './health.controller';
import { createReadyHandler } from './ready.controller';

export function createHealthRouter(pool: Pool): Router {
  const router = Router();
  router.get('/health', getHealth);
  router.get('/ready', createReadyHandler(pool));
  return router;
}
