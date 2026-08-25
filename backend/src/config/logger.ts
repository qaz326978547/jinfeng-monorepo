import pino from 'pino';
import type { Env } from './env';

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): pino.Logger {
  const options: pino.LoggerOptions = {
    level: env.LOG_LEVEL,
    base: { env: env.NODE_ENV },
  };

  if (env.NODE_ENV === 'development') {
    options.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' },
    };
  }

  return pino(options);
}
