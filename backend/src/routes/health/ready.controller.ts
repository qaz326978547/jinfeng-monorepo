import type { Request, Response } from 'express';
import type { Pool } from 'mysql2/promise';
import { pingPool } from '../../infrastructure/database/client';

/** Readiness probe: can this instance actually serve traffic (DB reachable)? */
export function createReadyHandler(pool: Pool) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      await pingPool(pool);
      res.status(200).json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        reason: error instanceof Error ? error.message : 'database unreachable',
      });
    }
  };
}
