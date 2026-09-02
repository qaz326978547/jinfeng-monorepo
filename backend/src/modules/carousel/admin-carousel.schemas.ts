import { z } from 'zod';
import {
  ALLOWED_CAROUSEL_CONTENT_TYPES,
  CAROUSEL_IMAGE_VARIANTS,
  CAROUSEL_MAX_UPLOAD_BYTES,
} from '../../infrastructure/storage/carousel-image-key';

export const adminCarouselIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * Shared by POST /admin/carousels and PUT /admin/carousels/{id}. New Node/Admin feature —
 * no legacy contract to mirror (see specs/backend/laravel-to-node-parity.md convention for
 * FAQ admin), so this defines its own contract from the requirements.
 *
 * Only *ImageKey is accepted from the client, never *ImageUrl — the public URL is always
 * derived server-side from AWS_S3_PUBLIC_BASE_URL + key (see admin-carousel.service.ts), so
 * a client can never make the stored imageUrl point somewhere it doesn't control. Both
 * desktop and mobile keys are required on every write (create AND update): to keep an image
 * unchanged on edit, the caller resends that image's existing key; to replace one, it resends
 * a fresh key obtained from POST /admin/carousels/upload-url.
 */
export const carouselWriteRequestSchema = z
  .object({
    title: z.string({ error: 'title 為必填欄位' }).min(1, 'title 為必填欄位'),
    desktopImageKey: z
      .string({ error: 'desktopImageKey 為必填欄位' })
      .min(1, 'desktopImageKey 為必填欄位'),
    mobileImageKey: z
      .string({ error: 'mobileImageKey 為必填欄位' })
      .min(1, 'mobileImageKey 為必填欄位'),
    linkType: z.enum(['internal', 'external', 'none'], {
      error: 'linkType 必須為 internal、external 或 none',
    }),
    linkUrl: z.string().min(1).nullable().optional(),
    sortOrder: z.number({ error: 'sortOrder 為必填欄位' }).int('sortOrder 必須為整數'),
    isActive: z.boolean({ error: 'isActive 為必填欄位' }),
  })
  .superRefine((data, ctx) => {
    if (data.linkType === 'external' && !/^https?:\/\//i.test(data.linkUrl ?? '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['linkUrl'],
        message: 'linkType 為 external 時，linkUrl 必須是 http(s):// 開頭的網址',
      });
    }
    if (data.linkType === 'internal' && !data.linkUrl?.startsWith('/')) {
      ctx.addIssue({
        code: 'custom',
        path: ['linkUrl'],
        message: 'linkType 為 internal 時，linkUrl 必須是 / 開頭的路徑',
      });
    }
  });

export type CarouselWriteRequest = z.infer<typeof carouselWriteRequestSchema>;

export const uploadUrlRequestSchema = z.object({
  fileName: z.string({ error: 'fileName 為必填欄位' }).min(1, 'fileName 為必填欄位'),
  contentType: z.enum(ALLOWED_CAROUSEL_CONTENT_TYPES, {
    error: '不支援的圖片格式，僅允許 image/jpeg、image/png、image/webp',
  }),
  // Not part of the original 2-field request shape, but required to enforce the 5MB limit
  // server-side: a plain presigned PUT URL has no way to cap upload size at signing time
  // other than binding the request's Content-Length to this declared value (see
  // admin-carousel.service.ts::createUploadUrl).
  fileSize: z
    .number({ error: 'fileSize 為必填欄位' })
    .int('fileSize 必須為整數')
    .positive('fileSize 必須大於 0')
    .max(CAROUSEL_MAX_UPLOAD_BYTES, `檔案大小不可超過 ${CAROUSEL_MAX_UPLOAD_BYTES / (1024 * 1024)}MB`),
  // Picks the S3 key prefix (carousel/desktop/... vs carousel/mobile/...) — a validated
  // enum, not a free-form path segment the client controls.
  variant: z.enum(CAROUSEL_IMAGE_VARIANTS, {
    error: 'variant 必須為 desktop 或 mobile',
  }),
});

export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;
