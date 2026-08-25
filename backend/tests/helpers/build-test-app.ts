import pino from 'pino';
import { vi } from 'vitest';
import type { Express } from 'express';
import type { Pool } from 'mysql2/promise';
import { createApp } from '../../src/app';
import { loadEnv, type Env } from '../../src/config/env';

const TEST_ENV_SOURCE: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '8080',
  LOG_LEVEL: 'silent',
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  DB_USER: 'test',
  DB_PASSWORD: 'test',
  DB_DATABASE: 'jinfeng_test',
  JWT_SECRET: 'test-only-secret-not-for-real-use',
  JWT_EXPIRES_IN: '1d',
  BCRYPT_SALT_ROUNDS: '4',
  CORS_ALLOWED_ORIGINS: '',
};

export function createMockPool(overrides: Partial<Pool> = {}): Pool {
  return {
    query: vi.fn().mockResolvedValue([[], []]),
    ...overrides,
  } as unknown as Pool;
}

export interface TestApp {
  app: Express;
  env: Env;
  pool: Pool;
}

export function buildTestApp(options: { pool?: Pool; env?: Partial<Env> } = {}): TestApp {
  const env = { ...loadEnv(TEST_ENV_SOURCE), ...options.env };
  const pool = options.pool ?? createMockPool();
  const logger = pino({ level: 'silent' });
  const app = createApp({ env, pool, logger });
  return { app, env, pool };
}
