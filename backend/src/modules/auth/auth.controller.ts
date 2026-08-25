import type { Request, RequestHandler, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import { NotImplementedError } from '../../shared/errors/app-error';
import type { AuthService } from './auth.service';
import type { LoginRequest } from './auth.schemas';

/**
 * login is a factory, not a plain handler: it needs an AuthService instance
 * built once at the composition root (auth.routes.ts) with its injected
 * dependencies (JWT settings, repository, logger) — see plan.md "資料流程".
 * register/logout remain deferred stubs; out of this feature's scope.
 */
export function createLoginHandler(authService: AuthService): RequestHandler {
  return asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as LoginRequest;
    const { token } = await authService.login(email, password);
    res.status(200).json({ token });
  });
}

export function register(_req: Request, _res: Response): void {
  throw new NotImplementedError('POST /api/v2/auth/register is not implemented yet');
}

export function logout(_req: Request, _res: Response): void {
  throw new NotImplementedError('POST /api/v2/auth/logout is not implemented yet');
}
