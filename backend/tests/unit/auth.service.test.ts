import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Logger } from 'pino';
import { AuthService } from '../../src/modules/auth/auth.service';
import { UnauthorizedError } from '../../src/shared/errors/app-error';
import { FormRequestValidationError } from '../../src/shared/errors/form-request-validation-error';
import {
  DuplicateEmailError,
  type UserRepository,
  type UserRow,
} from '../../src/modules/auth/user.repository';

const JWT_SECRET = 'unit-test-secret-not-for-real-use';
const PASSWORD = 'correct-password';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);
const BCRYPT_SALT_ROUNDS = 4; // fast, test-only — not the production value

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
  describe('login()', () => {
    it('succeeds with valid credentials and signs a JWT from the injected settings', async () => {
      const repository = createFakeRepository(buildUser());
      const service = new AuthService({
        jwtSecret: JWT_SECRET,
        jwtExpiresIn: '1h',
        bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
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
        bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
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
        bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
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
        bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
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
      const service = new AuthService({
        jwtSecret: JWT_SECRET,
        jwtExpiresIn: '1h',
        bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
        repository,
        logger,
      });

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

    it('issues a token whose exp - iat matches a 30d jwtExpiresIn (~2,592,000 seconds)', async () => {
      const repository = createFakeRepository(buildUser());
      const service = new AuthService({
        jwtSecret: JWT_SECRET,
        jwtExpiresIn: '30d',
        bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
        repository,
        logger: createFakeLogger(),
      });

      const { token } = await service.login('user@example.com', PASSWORD);
      const decoded = jwt.verify(token, JWT_SECRET) as unknown as { iat: number; exp: number };

      const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;
      expect(decoded.exp - decoded.iat).toBe(THIRTY_DAYS_IN_SECONDS);
    });
  });

  describe('register()', () => {
    it('hashes the password with bcryptSaltRounds before writing it (never the plaintext)', async () => {
      const createUser = vi.fn().mockResolvedValue(1);
      const repository = { createUser } as unknown as UserRepository;
      const service = new AuthService({
        jwtSecret: JWT_SECRET,
        jwtExpiresIn: '1h',
        bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
        repository,
        logger: createFakeLogger(),
      });

      await service.register({
        name: '王小明',
        email: 'new@example.com',
        password: PASSWORD,
        password_confirmation: PASSWORD,
      });

      expect(createUser).toHaveBeenCalledTimes(1);
      const input = createUser.mock.calls[0]?.[0] as { passwordHash: string };
      expect(input.passwordHash).not.toBe(PASSWORD);
      expect(input.passwordHash).toMatch(/^\$2[aby]\$04\$/); // $04$ proves BCRYPT_SALT_ROUNDS was actually used
      expect(await bcrypt.compare(PASSWORD, input.passwordHash)).toBe(true);
    });

    it('omits isAdmin from the repository call when is_admin was not provided (lets the DB default apply)', async () => {
      const createUser = vi.fn().mockResolvedValue(1);
      const repository = { createUser } as unknown as UserRepository;
      const service = new AuthService({
        jwtSecret: JWT_SECRET,
        jwtExpiresIn: '1h',
        bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
        repository,
        logger: createFakeLogger(),
      });

      await service.register({
        name: '王小明',
        email: 'new@example.com',
        password: PASSWORD,
        password_confirmation: PASSWORD,
      });

      const input = createUser.mock.calls[0]?.[0] as Record<string, unknown>;
      expect('isAdmin' in input).toBe(false);
    });

    it('passes isAdmin: true through to the repository when provided', async () => {
      const createUser = vi.fn().mockResolvedValue(1);
      const repository = { createUser } as unknown as UserRepository;
      const service = new AuthService({
        jwtSecret: JWT_SECRET,
        jwtExpiresIn: '1h',
        bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
        repository,
        logger: createFakeLogger(),
      });

      await service.register({
        name: '王小明',
        email: 'new@example.com',
        password: PASSWORD,
        password_confirmation: PASSWORD,
        is_admin: true,
      });

      const input = createUser.mock.calls[0]?.[0] as { isAdmin?: boolean };
      expect(input.isAdmin).toBe(true);
    });

    it('translates DuplicateEmailError into a 400 FormRequestValidationError', async () => {
      const repository = {
        createUser: vi.fn().mockRejectedValue(new DuplicateEmailError()),
      } as unknown as UserRepository;
      const service = new AuthService({
        jwtSecret: JWT_SECRET,
        jwtExpiresIn: '1h',
        bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
        repository,
        logger: createFakeLogger(),
      });

      const error = await service
        .register({
          name: '王小明',
          email: 'taken@example.com',
          password: PASSWORD,
          password_confirmation: PASSWORD,
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(FormRequestValidationError);
      expect((error as FormRequestValidationError).message).toBe('email 已被使用');
      expect((error as FormRequestValidationError).statusCode).toBe(400);
    });
  });
});
