import type { CarouselRepository, PublicCarouselRow } from './carousel.repository';

export class CarouselService {
  constructor(private readonly repository: CarouselRepository) {}

  async listActive(): Promise<PublicCarouselRow[]> {
    return this.repository.findAllActiveForPublic();
  }
}
