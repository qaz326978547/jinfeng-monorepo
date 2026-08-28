import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';
import { toLegacyValidationErrors } from '../../src/shared/errors/legacy-validation-error';

const schema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

function parseFailure(input: unknown): ZodError {
  const result = schema.safeParse(input);
  if (result.success) {
    throw new Error('expected schema.safeParse to fail for this test input');
  }
  return result.error;
}

describe('toLegacyValidationErrors', () => {
  it('keys a normal field validation issue by its field name', () => {
    const errors = toLegacyValidationErrors(parseFailure({ email: 'not-an-email', password: '' }));

    expect(Array.isArray(errors.email)).toBe(true);
    expect(errors.email?.length).toBeGreaterThan(0);
    expect(Array.isArray(errors.password)).toBe(true);
  });

  it('splits a single unrecognized_keys issue into one entry per offending field, not a shared empty-string key', () => {
    const errors = toLegacyValidationErrors(
      parseFailure({
        email: 'user@example.com',
        password: 'secret',
        remember: true,
        extra: 1,
      }),
    );

    expect(errors['']).toBeUndefined();
    expect(errors._).toBeUndefined();
    expect(errors.remember).toEqual(['Unrecognized key: remember']);
    expect(errors.extra).toEqual(['Unrecognized key: extra']);
  });
});
