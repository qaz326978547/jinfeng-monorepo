import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import type { Logger } from 'pino';
import { authenticate } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validate-request';
import { createLoginHandler, createRegisterHandler, logout } from './auth.controller';
import { loginRequestSchema, registerRequestSchema } from './auth.schemas';
import { AuthService } from './auth.service';
import { UserRepository } from './user.repository';

export interface AuthRouterDeps {
  pool: Pool;
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptSaltRounds: number;
  logger: Logger;
}

/**
 * Composition root for the auth module: builds UserRepository/AuthService
 * once here (not per request) and injects them into the login/register
 * handlers — see plan.md "資料流程". AuthService never reads env or
 * constructs its own dependencies.
 */
export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  const repository = new UserRepository(deps.pool);
  const authService = new AuthService({
    jwtSecret: deps.jwtSecret,
    jwtExpiresIn: deps.jwtExpiresIn,
    bcryptSaltRounds: deps.bcryptSaltRounds,
    repository,
    logger: deps.logger,
  });

  router.post(
    '/login',
    validateRequest({ body: loginRequestSchema, legacyErrorFormat: true }),
    createLoginHandler(authService),
  );
  router.post(
    '/register',
    validateRequest({ body: registerRequestSchema, formRequestErrorFormat: true }),
    createRegisterHandler(authService),
  );
  router.post('/logout', authenticate(deps.jwtSecret), logout);

  return router;
}
