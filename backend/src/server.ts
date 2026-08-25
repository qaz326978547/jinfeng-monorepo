import { createApp } from './app';
import { buildPoolOptions } from './config/database';
import { getEnv } from './config/env';
import { createLogger } from './config/logger';
import { closePool, createPool } from './infrastructure/database/client';
import { registerGracefulShutdown } from './shared/utils/graceful-shutdown';

function main(): void {
  const env = getEnv();
  const logger = createLogger(env);
  const pool = createPool(buildPoolOptions(env));
  const app = createApp({ env, pool, logger });

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Server listening on 0.0.0.0:${env.PORT} (${env.NODE_ENV})`);
  });

  registerGracefulShutdown({
    server,
    logger,
    targets: [{ name: 'MySQL pool', close: closePool }],
  });
}

main();
