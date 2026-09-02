import { z } from 'zod';
import { pageQuerySchema } from '../../shared/http/pagination-query.schema';

export const adminLaborNewsIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const adminLaborNewsListQuerySchema = pageQuerySchema;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Rejects both malformed strings (regex) and calendar-invalid dates like 2026-02-30. */
function isValidDateOnlyString(value: string): boolean {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Shared by POST /admin/labor-news and PUT /admin/labor-news/{id}. New Node/Admin feature —
 * no legacy contract to mirror (see specs/backend/laravel-to-node-parity.md convention for
 * FAQ/carousel admin). sortOrder deliberately requires a non-negative integer (rejects
 * negative, decimal, NaN, and non-numeric garbage) and has no uniqueness requirement — see
 * the migration comment on why duplicate sort_order values are allowed.
 */
export const laborNewsWriteRequestSchema = z.object({
  title: z.string({ error: 'title 為必填欄位' }).min(1, 'title 為必填欄位'),
  sourceName: z.string({ error: 'sourceName 為必填欄位' }).min(1, 'sourceName 為必填欄位'),
  sourceUrl: z
    .string({ error: 'sourceUrl 為必填欄位' })
    .min(1, 'sourceUrl 為必填欄位')
    .regex(/^https?:\/\//i, 'sourceUrl 必須是 http:// 或 https:// 開頭的網址'),
  publishedAt: z
    .string({ error: 'publishedAt 為必填欄位' })
    .refine(isValidDateOnlyString, 'publishedAt 必須為有效的 YYYY-MM-DD 日期'),
  sortOrder: z
    .number({ error: 'sortOrder 為必填欄位' })
    .int('sortOrder 必須為整數')
    .nonnegative('sortOrder 不可為負數'),
  isActive: z.boolean({ error: 'isActive 為必填欄位' }),
});

export type LaborNewsWriteRequest = z.infer<typeof laborNewsWriteRequestSchema>;
