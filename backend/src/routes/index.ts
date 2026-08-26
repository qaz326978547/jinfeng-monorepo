import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import type { Transporter } from 'nodemailer';
import type { Logger } from 'pino';
import { createAuthRouter } from '../modules/auth/auth.routes';
import { createContactRouter } from '../modules/contact/contact.routes';
import { createAdminContactRouter } from '../modules/contact/admin-contact.routes';
import { createContactClassRouter } from '../modules/contact-class/contact-class.routes';
import { createAdminContactClassRouter } from '../modules/contact-class/admin-contact-class.routes';
import { createContactListRouter } from '../modules/contact-list/contact-list.routes';
import { createContactQuestRouter } from '../modules/contact-quest/contact-quest.routes';
import { createFaqRouter } from '../modules/faq/faq.routes';
import { createSeoRouter } from '../modules/seo/seo.routes';
import type { MailConfig } from '../infrastructure/mail/mail.config';
import { createHealthRouter } from './health/health.route';

export const API_V2_BASE_PATH = '/api/v2';

export interface RouterDeps {
  pool: Pool;
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptSaltRounds: number;
  mailConfig: MailConfig;
  /** Test-only mail transport override — see modules/contact/contact.routes.ts. */
  mailTransport?: Transporter | null | undefined;
  logger: Logger;
}

export function createRootRouter(deps: RouterDeps): Router {
  const router = Router();

  // Liveness/readiness probes are unversioned — Zeabur's reverse proxy and
  // Docker HEALTHCHECK hit these directly, not through /api/v2.
  router.use(createHealthRouter(deps.pool));

  const apiV2 = Router();
  apiV2.use(
    '/auth',
    createAuthRouter({
      pool: deps.pool,
      jwtSecret: deps.jwtSecret,
      jwtExpiresIn: deps.jwtExpiresIn,
      bcryptSaltRounds: deps.bcryptSaltRounds,
      logger: deps.logger,
    }),
  );
  apiV2.use('/seo', createSeoRouter({ pool: deps.pool }));
  apiV2.use('/faq', createFaqRouter({ pool: deps.pool }));
  apiV2.use('/contact-class', createContactClassRouter({ pool: deps.pool }));
  apiV2.use('/contact-quest', createContactQuestRouter({ pool: deps.pool }));
  apiV2.use(
    '/contact',
    createContactRouter({
      pool: deps.pool,
      mailConfig: deps.mailConfig,
      mailTransport: deps.mailTransport,
      logger: deps.logger,
    }),
  );
  // Admin endpoints — each router mounts its own authenticate + requireAdmin
  // (specs/backend/laravel-to-node-parity.md §10.13/§11): a normal logged-in
  // user must never reach these controllers, unlike the legacy Laravel app.
  apiV2.use(
    '/admin/contact',
    createAdminContactRouter({ pool: deps.pool, jwtSecret: deps.jwtSecret }),
  );
  apiV2.use(
    '/admin/contact-class',
    createAdminContactClassRouter({ pool: deps.pool, jwtSecret: deps.jwtSecret }),
  );
  apiV2.use(
    '/admin/contact-list',
    createContactListRouter({ pool: deps.pool, jwtSecret: deps.jwtSecret }),
  );
  // Remaining admin/* writes (POST/PUT/DELETE contact-class, DELETE contact)
  // mount here in a later batch; PUT /admin/contact/{id} is deferred (§11).
  router.use(API_V2_BASE_PATH, apiV2);

  return router;
}
