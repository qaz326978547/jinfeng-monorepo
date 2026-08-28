import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import type { Transporter } from 'nodemailer';
import type { Logger } from 'pino';
import { createMailTransport } from '../../infrastructure/mail/mail-transport';
import { ContactMailService } from '../../infrastructure/mail/mail.service';
import type { MailConfig } from '../../infrastructure/mail/mail.config';
import { validateRequest } from '../../middleware/validate-request';
import { createCreateContactHandler } from './contact.controller';
import { ContactRepository } from './contact.repository';
import { createContactRequestSchema } from './contact.schemas';
import { ContactService } from './contact.service';

export interface ContactRouterDeps {
  pool: Pool;
  mailConfig: MailConfig;
  logger: Logger;
  /**
   * Test-only override: when provided, used as-is instead of building a real
   * transport from `mailConfig` via createMailTransport(). Lets integration
   * tests inject a mock (e.g. `{ sendMail: vi.fn() }`) without ever
   * attempting a real SMTP connection. Production code never sets this —
   * see tests/helpers/build-test-app.ts.
   */
  mailTransport?: Transporter | null | undefined;
}

export function createContactRouter(deps: ContactRouterDeps): Router {
  const router = Router();

  const repository = new ContactRepository(deps.pool);
  const transporter =
    deps.mailTransport !== undefined ? deps.mailTransport : createMailTransport(deps.mailConfig);
  const mailService = new ContactMailService(transporter, deps.mailConfig, deps.logger);
  const service = new ContactService(repository, mailService);

  router.post(
    '/',
    validateRequest({ body: createContactRequestSchema, formRequestErrorFormat: true }),
    createCreateContactHandler(service),
  );

  return router;
}
