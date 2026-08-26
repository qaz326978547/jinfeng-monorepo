import { z } from 'zod';

/**
 * Mirrors the legacy `{ids: number | number[]}` shape (`DeleteByIdsRequest`
 * in openapi.yaml — UNCONFIRMED exact shape, but the frontend always sends
 * the array form even for a single id). Accepts a single positive integer
 * id or a non-empty array of them.
 *
 * Strings, zero, negative numbers, NaN, and empty arrays are all rejected.
 * Nothing in the legacy spec documents a validation-error response shape
 * for these DELETE endpoints (Laravel's `destroy()` here has no
 * FormRequest, unlike register/contact/contact-class create-update) — this
 * is a genuinely undocumented edge case, so it deliberately uses this
 * project's existing generic 400 `{message,code,requestId}` validation
 * envelope (validateRequest without `formRequestErrorFormat`) rather than
 * inventing a legacy-flavored shape nothing confirms.
 */
export const deleteByIdsSchema = z.object({
  ids: z.union([
    z.number({ error: 'ids 為必填欄位' }).int().positive(),
    z.array(z.number().int().positive()).min(1, 'ids 陣列至少需要一個 id'),
  ]),
});

export type DeleteByIdsInput = z.infer<typeof deleteByIdsSchema>;
