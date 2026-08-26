import type { Request, RequestHandler, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthService } from './auth.service';
import type { LoginRequest, RegisterRequest } from './auth.schemas';

/**
 * login/register are factories, not plain handlers: they need an
 * AuthService instance built once at the composition root (auth.routes.ts)
 * with its injected dependencies (JWT settings, bcrypt rounds, repository,
 * logger) — see plan.md "資料流程".
 */
export function createLoginHandler(authService: AuthService): RequestHandler {
  return asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as LoginRequest;
    const { token } = await authService.login(email, password);
    res.status(200).json({ token });
  });
}

export function createRegisterHandler(authService: AuthService): RequestHandler {
  return asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as RegisterRequest;
    await authService.register(body);
    res.status(201).json({ message: '註冊成功' });
  });
}

/**
 * Stateless logout (specs/backend/laravel-to-node-parity.md §10.9/§10.11,
 * intentional design decision): the `authenticate` middleware ahead of this
 * route on auth.routes.ts already rejects a missing/invalid/expired token
 * with 401, so reaching this handler means req.user is populated and the
 * token is currently valid. There is nothing further to check or revoke —
 * no DB write, no blacklist, no Redis. The same JWT remains technically
 * valid against `authenticate` until it naturally expires; the frontend is
 * responsible for discarding it from localStorage (not implemented yet,
 * see the parity doc).
 */
export function logout(_req: Request, res: Response): void {
  res.status(200).json({ message: '登出成功' });
}
