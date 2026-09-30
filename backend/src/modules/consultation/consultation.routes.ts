import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import type { Transporter } from 'nodemailer';
import type { Logger } from 'pino';
import { createMailTransport } from '../../infrastructure/mail/mail-transport';
import { ConsultationMailService } from '../../infrastructure/mail/mail.service';
import type { MailConfig } from '../../infrastructure/mail/mail.config';
import { validateRequest } from '../../middleware/validate-request';
import { createInMemoryRateLimiter } from '../../middleware/rate-limit';
import { createCreateConsultationHandler } from './consultation.controller';
import { ConsultationRepository } from './consultation.repository';
import { createConsultationRequestSchema } from './consultation.schemas';
import { ConsultationService } from './consultation.service';

export interface ConsultationRouterDeps {
  pool: Pool;
  mailConfig: MailConfig;
  logger: Logger;
  /** Test-only override: see modules/contact/contact.routes.ts for the same pattern. */
  mailTransport?: Transporter | null | undefined;
}

export function createConsultationRouter(deps: ConsultationRouterDeps): Router {
  const router = Router();

  const repository = new ConsultationRepository(deps.pool);
  const transporter =
    deps.mailTransport !== undefined ? deps.mailTransport : createMailTransport(deps.mailConfig);
  const mailService = new ConsultationMailService(transporter, deps.mailConfig, deps.logger);
  const service = new ConsultationService(repository, mailService);

  // 5 submissions / 10 minutes / IP — generous for a real visitor, painful for
  // a script. Created per router instance (not module-scoped) so its
  // in-memory state does not leak across the process's lifetime beyond this
  // one mounted route. Scoped to just this route; never applied globally
  // (see middleware/rate-limit.ts).
  const consultationRateLimiter = createInMemoryRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });

  router.post(
    '/',
    consultationRateLimiter,
    validateRequest({ body: createConsultationRequestSchema, formRequestErrorFormat: true }),
    createCreateConsultationHandler(service),
  );

  return router;
}
