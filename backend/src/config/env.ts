import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_DATABASE: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  /**
   * Deliberately an allowlist, not `z.string()` — any jsonwebtoken/ms-parseable
   * string (e.g. "365d", "10y") would otherwise be accepted, including
   * effectively-permanent values that make stateless logout meaningless (see
   * specs/backend/laravel-to-node-parity.md §10.5/§10.9). Product decision:
   * default/max is 30d so a logged-in user stays logged in across browser
   * restarts without re-authenticating, while still bounding how long a
   * stolen or "logged out" token can remain valid.
   */
  JWT_EXPIRES_IN: z
    .enum(['1d', '7d', '14d', '30d'], {
      error: 'JWT_EXPIRES_IN must be one of: 1d, 7d, 14d, 30d',
    })
    .default('30d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(20).default(10),

  CORS_ALLOWED_ORIGINS: z.string().default(''),

  // Mail is optional at the schema level: an unset MAIL_HOST means "mail not
  // configured" (see infrastructure/mail/mail-transport.ts), not a startup
  // failure — this app must keep serving every other endpoint even when
  // outbound mail isn't set up (e.g. local dev, or before Ops provisions
  // SMTP credentials).
  MAIL_HOST: z.string().default(''),
  MAIL_PORT: z.coerce.number().int().positive().default(587),
  MAIL_USERNAME: z.string().default(''),
  MAIL_PASSWORD: z.string().default(''),
  MAIL_ENCRYPTION: z.enum(['tls', 'ssl', 'none']).default('tls'),
  MAIL_FROM_ADDRESS: z.string().default('no-reply@example.com'),
  MAIL_FROM_NAME: z.string().default('Jinfeng'),
  RECIPIENT_EMAIL: z.string().default(''),

  // AWS S3 is optional at the schema level, same rationale as MAIL_* above: an unset
  // AWS_S3_BUCKET means "S3 not configured" (local dev, or before Ops provisions an IAM
  // user), not a startup failure. Endpoints that need S3 (upload-url, delete) must handle
  // a null S3 client — see infrastructure/storage/s3-client.ts.
  AWS_REGION: z.string().default(''),
  AWS_S3_BUCKET: z.string().default(''),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}

export function getEnv(): Env {
  cachedEnv ??= loadEnv();
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = undefined;
}
