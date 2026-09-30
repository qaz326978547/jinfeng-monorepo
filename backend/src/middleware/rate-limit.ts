import type { NextFunction, Request, Response } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
}

/**
 * Minimal in-memory sliding-window IP rate limiter — no dependency, no
 * shared state across processes. This repo has no rate-limiting middleware
 * anywhere else (confirmed: app.ts only wires helmet/cors/express.json()),
 * so a single-instance approximate limit is a meaningful anti-spam
 * improvement over nothing for a public lead-capture endpoint. Intended to
 * be mounted per-route, never globally.
 *
 * `req.ip` is reliable here because app.ts already sets `trust proxy: 1`
 * for Zeabur's reverse proxy.
 *
 * Known tradeoff: the Map grows by one entry per distinct IP that has ever
 * posted and is never proactively evicted. Acceptable at this endpoint's
 * expected volume (a lead-capture form, not a high-traffic API) — revisit
 * if that assumption stops holding.
 */
export function createInMemoryRateLimiter({ windowMs, max }: RateLimiterOptions) {
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= max) {
      res.status(429).json({ message: '請求過於頻繁，請稍後再試' });
      return;
    }

    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}
