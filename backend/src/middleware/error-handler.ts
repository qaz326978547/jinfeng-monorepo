import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { isAppError } from '../shared/errors/app-error';
import { LegacyValidationError } from '../shared/errors/legacy-validation-error';

interface ErrorResponseBody {
  message: string;
  code: string;
  requestId: string;
  details?: unknown;
}

interface LegacyValidationErrorBody {
  message: string;
  errors: Record<string, string[]>;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId ?? 'unknown';

  // Must be checked before isAppError(err) — LegacyValidationError extends
  // AppError, but MUST NOT get the generic code/requestId envelope below.
  if (err instanceof LegacyValidationError) {
    const body: LegacyValidationErrorBody = {
      message: err.message,
      errors: err.errors,
    };
    res.status(err.statusCode).json(body);
    return;
  }

  if (isAppError(err)) {
    const body: ErrorResponseBody = {
      message: err.message,
      code: err.code,
      requestId,
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: ErrorResponseBody = {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      requestId,
      details: err.issues,
    };
    res.status(400).json(body);
    return;
  }

  req.log?.error({ err }, 'Unhandled error');

  const body: ErrorResponseBody = {
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId,
  };
  res.status(500).json(body);
}
