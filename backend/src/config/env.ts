import { isIP } from 'node:net';
import { z } from 'zod';

const PEM_CERTIFICATE_HEADER = '-----BEGIN CERTIFICATE-----';

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_DATABASE: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  // TLS to MySQL. Off by default so local Docker MySQL and the legacy Zeabur
  // database keep working; DigitalOcean Managed MySQL requires it. When on,
  // the server certificate is ALWAYS verified against DB_SSL_CA and its
  // hostname against DB_HOST — there is deliberately no switch to skip
  // either check (see config/database.ts).
  DB_SSL: z
    .enum(['true', 'false'], { error: 'DB_SSL must be "true" or "false"' })
    .default('false')
    .transform((value) => value === 'true'),
  // PEM text of the CA that signed the server certificate (DigitalOcean:
  // the cluster's "CA certificate" download). Literal `\n` sequences are
  // turned into newlines so the PEM can be stored as a single-line env var.
  DB_SSL_CA: z
    .string()
    .default('')
    .transform((value) => value.replace(/\\n/g, '\n').trim()),

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
  // Unused since POST /auth/register was removed (2026-10-26) — nothing in the
  // app hashes passwords any more. Kept so existing deployment env stays valid.
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(20).default(10),

  CORS_ALLOWED_ORIGINS: z.string().default(''),
  // Header the platform's edge sets to the real client IP, used as the
  // rate-limit key (middleware/client-ip.ts). Empty = use req.ip (Zeabur, via
  // `trust proxy: 1`). DigitalOcean App Platform: `do-connecting-ip` — its
  // X-Forwarded-For carries the DO ingress IP, so req.ip there is shared by
  // every visitor. Only set this to a header the edge overwrites on every
  // request; a header clients can pass through would let them pick their key.
  CLIENT_IP_HEADER: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]*$/, 'CLIENT_IP_HEADER must be a bare header name, e.g. do-connecting-ip')
    .default(''),

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
  // Public read access to carousel images goes through CloudFront (private S3 bucket), not a
  // direct *.s3.<region>.amazonaws.com URL — see infrastructure/storage/carousel-image-key.ts.
  // Optional at the schema level for the same reason as the other AWS_* vars: an unset value
  // means "S3/CDN not configured" (local dev), not a startup failure. When set, must be an
  // http(s) origin with no trailing slash so `${AWS_S3_PUBLIC_BASE_URL}/${imageKey}` composes
  // cleanly (e.g. https://cdn.laborservice5690.com).
  AWS_S3_PUBLIC_BASE_URL: z.string().default('').refine(
    (value) => value === '' || (/^https?:\/\//i.test(value) && !value.endsWith('/')),
    {
      message:
        'AWS_S3_PUBLIC_BASE_URL must be an http(s) URL with no trailing slash (e.g. https://cdn.example.com)',
    },
  ),
});

const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (!env.DB_SSL) {
    return;
  }
  if (!env.DB_SSL_CA.includes(PEM_CERTIFICATE_HEADER)) {
    ctx.addIssue({
      code: 'custom',
      path: ['DB_SSL_CA'],
      message: `DB_SSL_CA must contain a PEM CA certificate (${PEM_CERTIFICATE_HEADER}) when DB_SSL=true`,
    });
  }
  // mysql2 only sends SNI / checks the certificate hostname when the host is
  // a name; with an IP the identity check would silently not happen.
  if (isIP(env.DB_HOST) !== 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['DB_HOST'],
      message:
        'DB_HOST must be the hostname on the server certificate (not an IP address) when DB_SSL=true',
    });
  }
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
