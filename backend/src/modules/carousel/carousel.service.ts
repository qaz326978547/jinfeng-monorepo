import type { CarouselRepository, PublicCarousel } from './carousel.repository';

export class CarouselService {
  constructor(private readonly repository: CarouselRepository) {}

  async listActive(): Promise<PublicCarousel[]> {
    return this.repository.findAllActiveForPublic();
  }
}
