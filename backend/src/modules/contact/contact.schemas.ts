import { z } from 'zod';

/**
 * Field order below matches api-specification.md #4's validation table —
 * this determines which message Zod reports first (`.issues[0]`), which is
 * what firstValidationMessage() (form-request-validation-error.ts) surfaces
 * as the single `message` in the 400 response, mirroring Laravel's
 * `$validator->errors()->first()`.
 *
 * Every required string uses `z.string({ error: ... })` (not just
 * `.min(1, ...)`) because Zod's base type check runs before any refinement
 * — a genuinely missing key fails with Zod's generic "expected string,
 * received undefined" before `.min()` ever sees it. The `{error}` option
 * covers that base check; `.min()`/`.max()`/`.email()` cover the
 * present-but-invalid cases with their own, more specific message.
 *
 * Exact Traditional Chinese wording is this project's own, not a captured
 * copy of the legacy Laravel validation messages — migration-history has no
 * record of the original strings (custom FormRequest messages() array or
 * the zh-TW lang file), only the {status:"error", message} envelope shape.
 * See specs/backend/laravel-to-node-parity.md for this documented gap.
 * Frontend does not pattern-match on message text (see
 * api/signedUpClass.ts:addContactInfo — just alerts whatever string comes
 * back), so this does not break request/response compatibility.
 */

/**
 * `ticket` is optional and, when provided, restricted to "2"/"3"
 * (api-specification.md #4). The live frontend form always sends `""` when
 * the user hasn't picked either radio button (components/SignUpClassForm.vue
 * — default ref value, no `required` attribute on the inputs) — treating
 * "" as "not provided" preserves frontend compatibility instead of 400-ing
 * a very common real user flow.
 */
const ticketSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.enum(['2', '3'], { message: 'ticket 僅允許 "2" 或 "3"' }).optional(),
);

const requiredString = (label: string) => z.string({ error: `${label} 為必填欄位` }).min(1, `${label} 為必填欄位`);

const optionalNullableString = (max: number, label: string) =>
  z.string().max(max, `${label} 不可超過 ${max} 個字元`).optional().nullable();

export const contactListItemSchema = z.object({
  name: requiredString('contactList 內每筆聯絡人的 name'),
  email: z
    .string({ error: 'contactList 內每筆聯絡人的 email 為必填欄位' })
    .email('contactList 內每筆聯絡人的 email 格式不正確'),
  job: z.string().optional().nullable(),
  cel: requiredString('contactList 內每筆聯絡人的 cel').max(
    10,
    'contactList 內每筆聯絡人的 cel 不可超過 10 個字元',
  ),
});

export const createContactRequestSchema = z.object({
  class: requiredString('class'),
  quest: requiredString('quest'),
  company: requiredString('company'),
  tel: requiredString('tel').max(10, 'tel 不可超過 10 個字元'),
  num: requiredString('num'),
  last5: optionalNullableString(5, 'last5'),
  ticket: ticketSchema,
  ticket_name: z.string().optional().nullable(),
  ticket_no: z.string().optional().nullable(),
  ticket_address: z.string().optional().nullable(),
  from: z.string().optional().nullable(),
  suggest_name: z.string().optional().nullable(),
  contactList: z.array(contactListItemSchema, { error: 'contactList 為必填欄位，且必須為陣列' }),
});

export type CreateContactRequest = z.infer<typeof createContactRequestSchema>;
