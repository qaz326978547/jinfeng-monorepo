export interface ShutdownTarget {
  name: string;
  close: () => Promise<void>;
}

export interface ShutdownLogger {
  info: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
}

/**
 * Deliberately narrower than node:http's Server type (whose close()
 * overloads return `this`) so both the real http.Server and simple test
 * doubles satisfy it without casts.
 */
export interface CloseableServer {
  close: (callback?: (err?: Error) => void) => unknown;
}

export interface GracefulShutdownOptions {
  server: CloseableServer;
  logger: ShutdownLogger;
  targets?: ShutdownTarget[];
  signals?: NodeJS.Signals[];
  timeoutMs?: number;
  onExit?: (code: number) => void;
}

function closeServer(server: CloseableServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Wires SIGTERM/SIGINT to a shutdown routine that stops accepting new
 * connections, closes registered targets (e.g. the MySQL pool), and force
 * exits if cleanup hangs past timeoutMs. Kept separate from server.ts so it
 * can be unit tested without sending real OS signals.
 */
export function registerGracefulShutdown(options: GracefulShutdownOptions): {
  shutdown: (signal?: NodeJS.Signals | 'MANUAL') => Promise<void>;
} {
  const {
    server,
    logger,
    targets = [],
    signals = ['SIGTERM', 'SIGINT'],
    timeoutMs = 10_000,
    onExit = (code) => process.exit(code),
  } = options;

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals | 'MANUAL' = 'MANUAL'): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown`);

    const forceExitTimer = setTimeout(() => {
      logger.error(`Graceful shutdown timed out after ${timeoutMs}ms, forcing exit`);
      onExit(1);
    }, timeoutMs);
    forceExitTimer.unref?.();

    try {
      await closeServer(server);
      logger.info('HTTP server closed');

      for (const target of targets) {
        await target.close();
        logger.info(`${target.name} closed`);
      }

      clearTimeout(forceExitTimer);
      onExit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);
      logger.error('Error during graceful shutdown', error);
      onExit(1);
    }
  };

  for (const signal of signals) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }

  return { shutdown };
}
