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
    expect(env.JWT_EXPIRES_IN).toBe('1d');
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
});
