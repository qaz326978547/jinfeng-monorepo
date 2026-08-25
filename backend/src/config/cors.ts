import type { CorsOptions } from 'cors';
import type { Env } from './env';

/**
 * CORS_ALLOWED_ORIGINS is a comma-separated allowlist. An empty value means
 * no cross-origin browser access is permitted (server-to-server calls are
 * unaffected since CORS is a browser-only mechanism).
 */
export function buildCorsOptions(env: Pick<Env, 'CORS_ALLOWED_ORIGINS'>): CorsOptions {
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  };
}
