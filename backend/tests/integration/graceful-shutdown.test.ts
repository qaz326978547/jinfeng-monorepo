import { describe, expect, it, vi } from 'vitest';
import { registerGracefulShutdown } from '../../src/shared/utils/graceful-shutdown';

function mockServer() {
  return { close: vi.fn((cb?: (err?: Error) => void) => cb?.()) };
}

function mockLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

describe('registerGracefulShutdown', () => {
  it('closes the HTTP server and all targets, then exits 0', async () => {
    const server = mockServer();
    const logger = mockLogger();
    const onExit = vi.fn();
    const dbClose = vi.fn().mockResolvedValue(undefined);

    const { shutdown } = registerGracefulShutdown({
      server,
      logger,
      signals: [],
      onExit,
      targets: [{ name: 'MySQL pool', close: dbClose }],
    });

    await shutdown('MANUAL');

    expect(server.close).toHaveBeenCalled();
    expect(dbClose).toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledWith(0);
  });

  it('exits 1 and logs when a target fails to close', async () => {
    const server = mockServer();
    const logger = mockLogger();
    const onExit = vi.fn();

    const { shutdown } = registerGracefulShutdown({
      server,
      logger,
      signals: [],
      onExit,
      targets: [{ name: 'MySQL pool', close: vi.fn().mockRejectedValue(new Error('nope')) }],
    });

    await shutdown('MANUAL');

    expect(onExit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it('ignores a second concurrent shutdown call', async () => {
    const server = mockServer();
    const logger = mockLogger();
    const onExit = vi.fn();

    const { shutdown } = registerGracefulShutdown({ server, logger, signals: [], onExit });

    await Promise.all([shutdown('MANUAL'), shutdown('MANUAL')]);

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
