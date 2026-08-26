import type { Request } from 'express';

/**
 * Laravel's paginator `path()` — the current request URL, without the query
 * string. Used to build `first_page_url`/`last_page_url`/etc in
 * laravel-pagination.ts's envelope.
 */
export function buildRequestPath(req: Request): string {
  const pathOnly = req.originalUrl.split('?')[0];
  return `${req.protocol}://${req.get('host')}${pathOnly}`;
}
