import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import type { S3Client } from '@aws-sdk/client-s3';
import type { Logger } from 'pino';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate-request';
import type { S3Config } from '../../infrastructure/storage/s3.config';
import {
  createAdminCarouselUploadUrlHandler,
  createAdminCreateCarouselHandler,
  createAdminDeleteCarouselHandler,
  createAdminListCarouselHandler,
  createAdminUpdateCarouselHandler,
} from './admin-carousel.controller';
import {
  adminCarouselIdParamsSchema,
  carouselWriteRequestSchema,
  uploadUrlRequestSchema,
} from './admin-carousel.schemas';
import { AdminCarouselService } from './admin-carousel.service';
import { CarouselRepository } from './carousel.repository';

export interface AdminCarouselRouterDeps {
  pool: Pool;
  jwtSecret: string;
  s3Client: S3Client | null;
  s3Config: S3Config;
  logger: Logger;
}

export function createAdminCarouselRouter(deps: AdminCarouselRouterDeps): Router {
  const router = Router();
  router.use(authenticate(deps.jwtSecret), requireAdmin);

  const repository = new CarouselRepository(deps.pool);
  const service = new AdminCarouselService(repository, deps.s3Client, deps.s3Config, deps.logger);

  router.get('/', createAdminListCarouselHandler(service));
  router.post(
    '/',
    validateRequest({ body: carouselWriteRequestSchema, formRequestErrorFormat: true }),
    createAdminCreateCarouselHandler(service),
  );
  router.post(
    '/upload-url',
    validateRequest({ body: uploadUrlRequestSchema, formRequestErrorFormat: true }),
    createAdminCarouselUploadUrlHandler(service),
  );
  router.put(
    '/:id',
    validateRequest({
      params: adminCarouselIdParamsSchema,
      body: carouselWriteRequestSchema,
      formRequestErrorFormat: true,
    }),
    createAdminUpdateCarouselHandler(service),
  );
  router.delete(
    '/:id',
    validateRequest({ params: adminCarouselIdParamsSchema }),
    createAdminDeleteCarouselHandler(service),
  );

  return router;
}
