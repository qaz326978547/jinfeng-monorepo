import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../shared/errors/app-error';

/**
 * Requires req.user.isAdmin. Must run after authenticate(). Legacy admin
 * routes only ever checked "is logged in" (known-legacy-issues.md #2); real
 * role enforcement here is a deliberate behaviour change reserved for when
 * the admin endpoints are actually implemented, not wired to any route yet.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }
  if (!req.user.isAdmin) {
    next(new ForbiddenError('Admin privileges required'));
    return;
  }
  next();
}
