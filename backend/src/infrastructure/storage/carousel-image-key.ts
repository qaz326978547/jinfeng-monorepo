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
 * The backend always generates the key — client-supplied fileName/path is never trusted
 * (no `../`, no arbitrary key, no overwriting an existing object). The extension comes from
 * the validated contentType, not from the client's fileName.
 */
export function generateCarouselImageKey(contentType: CarouselContentType): string {
  return `carousel/${randomUUID()}.${CONTENT_TYPE_EXTENSIONS[contentType]}`;
}

export function buildCarouselImageUrl(bucket: string, region: string, imageKey: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${imageKey}`;
}
