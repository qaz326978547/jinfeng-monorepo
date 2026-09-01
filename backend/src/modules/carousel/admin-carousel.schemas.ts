import { z } from 'zod';
import {
  ALLOWED_CAROUSEL_CONTENT_TYPES,
  CAROUSEL_MAX_UPLOAD_BYTES,
} from '../../infrastructure/storage/carousel-image-key';

export const adminCarouselIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * Shared by POST /admin/carousels and PUT /admin/carousels/{id}. New Node/Admin feature —
 * no legacy contract to mirror (see specs/backend/laravel-to-node-parity.md convention for
 * FAQ admin), so this defines its own contract from the requirements: title/imageUrl/imageKey
 * required strings, linkType constrained to the three allowed values with linkUrl format
 * cross-checked against it, sortOrder a required integer, isActive a required boolean.
 */
export const carouselWriteRequestSchema = z
  .object({
    title: z.string({ error: 'title 為必填欄位' }).min(1, 'title 為必填欄位'),
    imageUrl: z.string({ error: 'imageUrl 為必填欄位' }).min(1, 'imageUrl 為必填欄位'),
    imageKey: z.string({ error: 'imageKey 為必填欄位' }).min(1, 'imageKey 為必填欄位'),
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
});

export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;
