import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { createListCarouselHandler } from './carousel.controller';
import { CarouselRepository } from './carousel.repository';
import { CarouselService } from './carousel.service';

export interface CarouselRouterDeps {
  pool: Pool;
}

export function createCarouselRouter(deps: CarouselRouterDeps): Router {
  const router = Router();
  const repository = new CarouselRepository(deps.pool);
  const service = new CarouselService(repository);

  router.get('/', createListCarouselHandler(service));

  return router;
}
