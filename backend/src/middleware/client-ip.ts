import { isIP } from 'node:net';
import type { NextFunction, Request, Response } from 'express';

/**
 * Sets `req.clientIp`, the key the in-memory rate limiters count against.
 *
 * With `header` empty this is just `req.ip` (Zeabur: `trust proxy: 1`). With
 * `header` set (DigitalOcean: `do-connecting-ip`), the header wins — but only
 * when it holds exactly one valid IP. A missing, comma-separated or garbage
 * value falls back to `req.ip`, which on DO is the shared ingress address:
 * a malformed request lands in the strict shared bucket instead of getting a
 * fresh one per made-up value.
 */
export function createClientIp(header: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const fallback = req.ip ?? 'unknown';
    if (!header) {
      req.clientIp = fallback;
      next();
      return;
    }

    const value = req.header(header)?.trim() ?? '';
    req.clientIp = isIP(value) ? value : fallback;
    next();
  };
}
