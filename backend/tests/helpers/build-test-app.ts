import pino from 'pino';
import { vi } from 'vitest';
import type { Express } from 'express';
import type { Pool } from 'mysql2/promise';
import type { Transporter } from 'nodemailer';
import type { S3Client } from '@aws-sdk/client-s3';
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
  AWS_REGION: 'us-east-1',
  AWS_S3_BUCKET: 'test-bucket',
  AWS_ACCESS_KEY_ID: 'test-access-key-id',
  AWS_SECRET_ACCESS_KEY: 'test-secret-access-key',
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

export function createMockS3Client(overrides: Partial<S3Client> = {}): S3Client {
  return {
    send: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as S3Client;
}

export function createMockMailTransport(overrides: Partial<Transporter> = {}): Transporter {
  return {
    sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
    ...overrides,
  } as unknown as Transporter;
}

export function buildTestApp(
  options: {
    pool?: Pool;
    env?: Partial<Env>;
    mailTransport?: Transporter | null;
    s3Client?: S3Client | null;
  } = {},
): TestApp {
  const env = { ...loadEnv(TEST_ENV_SOURCE), ...options.env };
  const pool = options.pool ?? createMockPool();
  const logger = pino({ level: 'silent' });
  const app = createApp({
    env,
    pool,
    logger,
    mailTransport: options.mailTransport,
    s3Client: options.s3Client,
  });
  return { app, env, pool };
}
