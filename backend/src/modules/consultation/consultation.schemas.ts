import { z } from 'zod';

export const CALLBACK_TIME_VALUES = ['anytime', 'morning', 'noon', 'afternoon', 'evening'] as const;

const requiredString = (label: string) =>
  z.string({ error: `${label} 為必填欄位` }).trim().min(1, `${label} 為必填欄位`);

const optionalNullableString = (max: number, label: string) =>
  z.string().max(max, `${label} 不可超過 ${max} 個字元`).optional().nullable();

function hasNoDuplicates(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/** "anytime" is mutually exclusive with every other callback-time value —
 *  enforced server-side, not just via the frontend's auto-uncheck UX. */
function respectsAnytimeExclusivity(values: readonly string[]): boolean {
  return !(values.includes('anytime') && values.length > 1);
}

const callbackTimesSchema = z
  .array(
    z.enum(CALLBACK_TIME_VALUES, {
      error: 'callbackTimes 僅允許 anytime、morning、noon、afternoon、evening',
    }),
    { error: 'callbackTimes 為必填欄位，且必須為陣列' },
  )
  .min(1, 'callbackTimes 為必填欄位，至少需選擇一個時段')
  .refine(hasNoDuplicates, { message: 'callbackTimes 不可包含重複的時段' })
  .refine(respectsAnytimeExclusivity, {
    message: '選擇「anytime」時不可再選擇其他時段',
  });

/**
 * status is deliberately NOT declared here — z.object()'s default (non-strict)
 * behavior strips any unrecognized key on parse, so a client-sent `status`
 * field is silently dropped before it ever reaches the service/repository.
 * The repository's INSERT also never accepts a status column — belt-and-
 * suspenders enforcement of "public POST cannot control status" together
 * with the migration's DB-level DEFAULT 'pending'.
 */
export const createConsultationRequestSchema = z.object({
  name: requiredString('name').max(100, 'name 不可超過 100 個字元'),
  phone: requiredString('phone').max(20, 'phone 不可超過 20 個字元'),
  companyName: optionalNullableString(200, 'companyName'),
  taxId: optionalNullableString(50, 'taxId'),
  lineId: optionalNullableString(100, 'lineId'),
  message: optionalNullableString(1000, 'message'),
  callbackTimes: callbackTimesSchema,
});

export type CreateConsultationRequest = z.infer<typeof createConsultationRequestSchema>;
