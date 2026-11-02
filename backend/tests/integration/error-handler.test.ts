import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/error-handler';
import { NotFoundError } from '../../src/shared/errors/app-error';
import { POOL_ACQUIRE_TIMEOUT_CODE } from '../../src/infrastructure/database/client';

function mockResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('maps AppError subclasses to their status code and error code', () => {
    const req = { requestId: 'req-1' } as Request;
    const res = mockResponse();

    errorHandler(new NotFoundError('missing thing'), req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_FOUND', requestId: 'req-1' }),
    );
  });

  it('maps ZodError to 400 VALIDATION_ERROR with issue details', () => {
    const req = { requestId: 'req-2' } as Request;
    const res = mockResponse();
    const result = z.object({ email: z.string().email() }).safeParse({ email: 'nope' });

    errorHandler(result.error, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('maps unknown errors to a generic 500 and logs via req.log', () => {
    const logError = vi.fn();
    const req = { requestId: 'req-3', log: { error: logError } } as unknown as Request;
    const res = mockResponse();

    errorHandler(new Error('boom'), req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
    expect(logError).toHaveBeenCalled();
  });

  it.each([
    ['acquire timeout', Object.assign(new Error('timed out'), { code: POOL_ACQUIRE_TIMEOUT_CODE })],
    ['mysql2 queue limit', new Error('Queue limit reached.')],
  ])('maps a saturated MySQL pool (%s) to 503 instead of 500', (_label, error) => {
    const logWarn = vi.fn();
    const req = { requestId: 'req-4', log: { warn: logWarn } } as unknown as Request;
    const res = mockResponse();

    errorHandler(error, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DB_POOL_SATURATED', message: '系統忙碌中，請稍後再試' }),
    );
    expect(logWarn).toHaveBeenCalled();
  });
});
