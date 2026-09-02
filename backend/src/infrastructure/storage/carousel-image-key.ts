import { randomUUID } from 'node:crypto';

export const ALLOWED_CAROUSEL_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type CarouselContentType = (typeof ALLOWED_CAROUSEL_CONTENT_TYPES)[number];

const CONTENT_TYPE_EXTENSIONS: Record<CarouselContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const CAROUSEL_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * A carousel row has two images (desktop 1920x1080 16:9, mobile 700x800 7:8), each uploaded
 * independently. Both live under carousel/* so the existing IAM policy
 * (arn:aws:s3:::<bucket>/carousel/*) still covers both without modification.
 */
export const CAROUSEL_IMAGE_VARIANTS = ['desktop', 'mobile'] as const;

export type CarouselImageVariant = (typeof CAROUSEL_IMAGE_VARIANTS)[number];

/**
 * The backend always generates the key — client-supplied fileName/path is never trusted
 * (no `../`, no arbitrary key, no overwriting an existing object). The extension comes from
 * the validated contentType, not from the client's fileName. `variant` picks the prefix
 * (carousel/desktop/... vs carousel/mobile/...), not an arbitrary client-supplied path.
 */
export function generateCarouselImageKey(
  variant: CarouselImageVariant,
  contentType: CarouselContentType,
): string {
  return `carousel/${variant}/${randomUUID()}.${CONTENT_TYPE_EXTENSIONS[contentType]}`;
}

/**
 * Public URL through CloudFront (the S3 bucket itself is private) — never a direct
 * *.s3.<region>.amazonaws.com URL. publicBaseUrl is validated (http(s), no trailing slash)
 * in config/env.ts, so this is a plain concatenation.
 */
export function buildCarouselImageUrl(publicBaseUrl: string, imageKey: string): string {
  return `${publicBaseUrl}/${imageKey}`;
}
