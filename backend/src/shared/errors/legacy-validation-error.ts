import type { ZodError } from 'zod';
import { AppError } from './app-error';

const LARAVEL_INVALID_DATA_MESSAGE = 'The given data was invalid.';

/**
 * Laravel-compatible validation error for POST /api/v2/auth/login only
 * (spec.md OD-1 / FR-001). Kept out of app-error.ts deliberately — this is
 * migration-specific compatibility logic, not part of the project's general
 * error hierarchy (research.md #2).
 */
export class LegacyValidationError extends AppError {
  readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>) {
    super(422, 'LEGACY_VALIDATION_ERROR', LARAVEL_INVALID_DATA_MESSAGE, errors);
    this.errors = errors;
  }
}

/**
 * Maps Zod issues onto Laravel's `errors: { field: [messages] }` shape.
 * Zod's `.strict()` violation surfaces as a single `unrecognized_keys` issue
 * with `keys: string[]` and an empty `path`, not one issue per offending key
 * — so it must be special-cased rather than derived from `issue.path`
 * (research.md #1).
 */
export function toLegacyValidationErrors(zodError: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  const appendError = (key: string, message: string): void => {
    (errors[key] ??= []).push(message);
  };

  for (const issue of zodError.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        appendError(key, `Unrecognized key: ${key}`);
      }
      continue;
    }

    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_';
    appendError(key, issue.message);
  }

  return errors;
}
