import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';

const VALID_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  DB_HOST: 'localhost',
  DB_USER: 'test',
  DB_DATABASE: 'jinfeng_test',
  JWT_SECRET: 'a-secret-that-is-long-enough',
};

describe('loadEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = loadEnv(VALID_ENV);

    expect(env.PORT).toBe(8080);
    expect(env.DB_PORT).toBe(3306);
    expect(env.JWT_EXPIRES_IN).toBe('30d');
    expect(env.BCRYPT_SALT_ROUNDS).toBe(10);
  });

  it('throws when a required variable is missing', () => {
    const { DB_HOST: _drop, ...rest } = VALID_ENV;
    expect(() => loadEnv(rest)).toThrow(/DB_HOST/);
  });

  it('throws when JWT_SECRET is too short', () => {
    expect(() => loadEnv({ ...VALID_ENV, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('throws when NODE_ENV has an unexpected value', () => {
    expect(() => loadEnv({ ...VALID_ENV, NODE_ENV: 'staging' })).toThrow();
  });

  /**
   * JWT_EXPIRES_IN is a fixed allowlist, not `z.string()` — see the comment
   * on the schema in src/config/env.ts and
   * specs/backend/laravel-to-node-parity.md §10.5/§10.9. loadEnv() is
   * called unguarded in server.ts's main() before the app starts accepting
   * requests, so every one of these "rejected" cases crashes the process at
   * boot (fail fast), not on the first login attempt.
   */
  describe('JWT_EXPIRES_IN allowlist', () => {
    it('defaults to 30d when unset', () => {
      expect(loadEnv(VALID_ENV).JWT_EXPIRES_IN).toBe('30d');
    });

    it.each(['1d', '7d', '14d', '30d'])('accepts %s', (value) => {
      expect(loadEnv({ ...VALID_ENV, JWT_EXPIRES_IN: value }).JWT_EXPIRES_IN).toBe(value);
    });

    it.each([
      '31d', // just over the 30d maximum
      '60d',
      '90d',
      '365d',
      '36500d', // ~100 years
      '10y',
      '1h',
      '2h',
      '4h',
      '8h',
      '12h', // shorter durations are also rejected — the allowlist is fixed, not just an upper bound
    ])('rejects %s even though jsonwebtoken/ms could otherwise parse it', (value) => {
      expect(() => loadEnv({ ...VALID_ENV, JWT_EXPIRES_IN: value })).toThrow(/JWT_EXPIRES_IN/);
    });

    it('rejects an empty string', () => {
      expect(() => loadEnv({ ...VALID_ENV, JWT_EXPIRES_IN: '' })).toThrow(/JWT_EXPIRES_IN/);
    });

    it('rejects a malformed, non-duration value', () => {
      expect(() => loadEnv({ ...VALID_ENV, JWT_EXPIRES_IN: 'not-a-duration' })).toThrow(
        /JWT_EXPIRES_IN/,
      );
    });

    it('rejects "permanent"/"forever"-style values outright — there is no way to configure a non-expiring JWT', () => {
      expect(() => loadEnv({ ...VALID_ENV, JWT_EXPIRES_IN: 'forever' })).toThrow(/JWT_EXPIRES_IN/);
      expect(() => loadEnv({ ...VALID_ENV, JWT_EXPIRES_IN: 'never' })).toThrow(/JWT_EXPIRES_IN/);
    });
  });
});
