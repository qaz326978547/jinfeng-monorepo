import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Logger } from 'pino';
import { AuthService } from '../../src/modules/auth/auth.service';
import { UnauthorizedError } from '../../src/shared/errors/app-error';
import type { UserRepository, UserRow } from '../../src/modules/auth/user.repository';

const JWT_SECRET = 'unit-test-secret-not-for-real-use';
const PASSWORD = 'correct-password';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

function createFakeLogger(): Logger {
  return { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } as unknown as Logger;
}

function createFakeRepository(user: UserRow | null): UserRepository {
  return { findByEmail: vi.fn().mockResolvedValue(user) } as unknown as UserRepository;
}

function buildUser(
  overrides: Partial<Pick<UserRow, 'id' | 'email' | 'password' | 'is_admin'>> = {},
): UserRow {
  return {
    id: 42,
    email: 'user@example.com',
    password: PASSWORD_HASH,
    is_admin: 0,
    ...overrides,
  } as UserRow;
}

// Proves plan.md's DI design: AuthService is constructed directly here with
// fake dependencies, with no Express app, no supertest, and no getEnv()/
// process.env access anywhere in the call path.
describe('AuthService (unit, no Express app)', () => {
  it('login() succeeds with valid credentials and signs a JWT from the injected settings', async () => {
    const repository = createFakeRepository(buildUser());
    const service = new AuthService({
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      repository,
      logger: createFakeLogger(),
    });

    const result = await service.login('user@example.com', PASSWORD);

    expect(typeof result.token).toBe('string');
    const decoded = jwt.verify(result.token, JWT_SECRET) as unknown as {
      sub: number;
      email: string;
      isAdmin: boolean;
    };
    expect(decoded.sub).toBe(42);
    expect(decoded.email).toBe('user@example.com');
    expect(decoded.isAdmin).toBe(false);
  });

  it('maps is_admin=1 to isAdmin: true', async () => {
    const repository = createFakeRepository(buildUser({ is_admin: 1 }));
    const service = new AuthService({
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      repository,
      logger: createFakeLogger(),
    });

    const { token } = await service.login('user@example.com', PASSWORD);
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as { isAdmin: boolean };
    expect(decoded.isAdmin).toBe(true);
  });

  it('throws UnauthorizedError with a generic message when the account does not exist', async () => {
    const repository = createFakeRepository(null);
    const service = new AuthService({
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      repository,
      logger: createFakeLogger(),
    });

    const error = await service.login('missing@example.com', 'whatever').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as Error).message).toBe('帳號或密碼錯誤');
  });

  it('throws the same generic message when the password does not match', async () => {
    const repository = createFakeRepository(buildUser());
    const service = new AuthService({
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      repository,
      logger: createFakeLogger(),
    });

    const error = await service.login('user@example.com', 'wrong-password').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as Error).message).toBe('帳號或密碼錯誤');
  });

  it('logs a secure, non-sensitive entry and throws a generic error when the stored hash is not a supported bcrypt format', async () => {
    const repository = createFakeRepository(buildUser({ password: 'not-a-bcrypt-hash' }));
    const logger = createFakeLogger();
    const service = new AuthService({ jwtSecret: JWT_SECRET, jwtExpiresIn: '1h', repository, logger });

    const error = await service.login('user@example.com', PASSWORD).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTH_PASSWORD_HASH_INTEGRITY_ERROR', userId: 42 }),
      expect.any(String),
    );
    const [logPayload] = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0] as [
      Record<string, unknown>,
      string,
    ];
    const raw = JSON.stringify(logPayload);
    expect(raw).not.toContain('user@example.com');
    expect(raw).not.toContain('not-a-bcrypt-hash');
  });
});
