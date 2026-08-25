import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Pool } from 'mysql2/promise';
import type { Transporter } from 'nodemailer';
import type { Logger } from 'pino';
import { buildCorsOptions } from './config/cors';
import type { Env } from './config/env';
import { buildMailConfig } from './infrastructure/mail/mail.config';
import { createHttpLogger } from './infrastructure/logger/http-logger';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { requestId } from './middleware/request-id';
import { createRootRouter } from './routes';

export interface CreateAppOptions {
  env: Env;
  pool: Pool;
  logger: Logger;
  /** Test-only mail transport override — see modules/contact/contact.routes.ts. */
  mailTransport?: Transporter | null | undefined;
}

/**
 * Builds the Express app without starting an HTTP listener. server.ts owns
 * listen()/shutdown so the app itself stays trivially testable with
 * supertest.
 */
export function createApp({ env, pool, logger, mailTransport }: CreateAppOptions): Express {
  const app = express();

  // Zeabur terminates TLS at a reverse proxy in front of this container.
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(createHttpLogger(logger));
  app.use(helmet());
  app.use(cors(buildCorsOptions(env)));
  app.use(express.json());

  app.use(
    createRootRouter({
      pool,
      jwtSecret: env.JWT_SECRET,
      jwtExpiresIn: env.JWT_EXPIRES_IN,
      mailConfig: buildMailConfig(env),
      mailTransport,
      logger,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
