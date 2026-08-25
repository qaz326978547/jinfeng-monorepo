import type { ZodError } from 'zod';
import { AppError } from './app-error';

/**
 * Laravel-compatible validation error shape used by every FormRequest-based
 * endpoint (App\Http\Requests\APIRequest::failedValidation()) — register,
 * contact store, contact-class store/update. HTTP 400 (not Laravel's
 * default 422), body is `{status: "error", message: <first error only>}`.
 * See specs/shared/api-contracts/api-specification.md "統一錯誤格式" #1.
 * Distinct from LegacyValidationError, which is the 422 `{message,errors}`
 * shape used only by auth/login.
 */
export class FormRequestValidationError extends AppError {
  constructor(message: string) {
    super(400, 'FORM_VALIDATION_ERROR', message);
  }
}

/** Laravel's `$validator->errors()->first()` — only the first issue, not all. */
export function firstValidationMessage(zodError: ZodError): string {
  return zodError.issues[0]?.message ?? 'Validation failed';
}
