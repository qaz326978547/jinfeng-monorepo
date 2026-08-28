import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { LegacyValidationError, toLegacyValidationErrors } from '../shared/errors/legacy-validation-error';
import { FormRequestValidationError, firstValidationMessage } from '../shared/errors/form-request-validation-error';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
  /**
   * When true, a ZodError thrown while parsing `body` is converted into a
   * LegacyValidationError (422, Laravel-compatible `{message, errors}`
   * shape) instead of being left for error-handler.ts's generic ZodError
   * branch (400). Default/omitted preserves the existing 400 behaviour for
   * every other route — only auth/login sets this (spec.md OD-1 / FR-001).
   */
  legacyErrorFormat?: boolean;
  /**
   * When true, a ZodError thrown while parsing `body` is converted into a
   * FormRequestValidationError (400, `{status:"error", message}` —
   * Laravel's FormRequest::failedValidation() shape) instead of the
   * project's general 400 envelope. Used by every FormRequest-equivalent
   * endpoint (register, contact store, contact-class store/update).
   * Mutually exclusive with `legacyErrorFormat` in practice — no endpoint
   * needs both.
   */
  formRequestErrorFormat?: boolean;
}

/**
 * Parses req.body/query/params against the given Zod schemas and replaces
 * them with the parsed (typed, coerced) values. Throws ZodError on failure,
 * which the global error handler converts into a 400 response — unless
 * `legacyErrorFormat` is set, in which case it is converted to a
 * LegacyValidationError (422) first.
 */
export function validateRequest(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        // Express 5's `req.query` is a getter that re-parses the URL on
        // every access rather than returning a cached object — mutating the
        // object it returns (`Object.assign(req.query, ...)`) is silently
        // lost on the next read. Overriding the property itself is the only
        // way to make the coerced/validated query values stick.
        Object.defineProperty(req, 'query', {
          value: schemas.query.parse(req.query),
          configurable: true,
          enumerable: true,
        });
      }
      if (schemas.params) {
        Object.assign(req.params, schemas.params.parse(req.params));
      }
      next();
    } catch (error) {
      if (schemas.legacyErrorFormat && error instanceof ZodError) {
        next(new LegacyValidationError(toLegacyValidationErrors(error)));
        return;
      }
      if (schemas.formRequestErrorFormat && error instanceof ZodError) {
        next(new FormRequestValidationError(firstValidationMessage(error)));
        return;
      }
      next(error);
    }
  };
}
