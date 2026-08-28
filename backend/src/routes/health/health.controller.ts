import type { Request, Response } from 'express';

/** Liveness probe: process is up and can serve requests. No DB dependency. */
export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
