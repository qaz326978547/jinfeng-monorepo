import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';
import type { UserRow } from '../../src/modules/auth/user.repository';

const PASSWORD = 'correct-password';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

function buildUserRow(
  overrides: Partial<Pick<UserRow, 'id' | 'email' | 'password' | 'is_admin'>> = {},
): UserRow {
  return {
    id: 7,
    email: 'user@example.com',
    password: PASSWORD_HASH,
    is_admin: 0,
    ...overrides,
  } as UserRow;
}

function poolReturning(rows: unknown[]) {
  return createMockPool({ query: vi.fn().mockResolvedValue([rows, []]) });
}

describe('POST /api/v2/auth/login', () => {
  describe('US1: successful login', () => {
    it('returns 200 with a token verifiable by the authenticate middleware', async () => {
      const pool = poolReturning([buildUserRow()]);
      const { app, env } = buildTestApp({ pool });

      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({ email: 'user@example.com', password: PASSWORD });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');

      const decoded = jwt.verify(res.body.token, env.JWT_SECRET) as unknown as {
        sub: number;
        email: string;
        isAdmin: boolean;
      };
      expect(decoded.sub).toBe(7);
      expect(decoded.email).toBe('user@example.com');
      expect(decoded.isAdmin).toBe(false);
    });

    it('maps is_admin=1 to isAdmin: true in the JWT payload', async () => {
      const pool = poolReturning([buildUserRow({ is_admin: 1 })]);
      const { app, env } = buildTestApp({ pool });

      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({ email: 'user@example.com', password: PASSWORD });

      expect(res.status).toBe(200);
      const decoded = jwt.verify(res.body.token, env.JWT_SECRET) as unknown as { isAdmin: boolean };
      expect(decoded.isAdmin).toBe(true);
    });

    it('allows the same credentials to be used twice, each producing an independently valid token', async () => {
      const pool = poolReturning([buildUserRow()]);
      const { app, env } = buildTestApp({ pool });
      const body = { email: 'user@example.com', password: PASSWORD };

      const first = await request(app).post('/api/v2/auth/login').send(body);
      const second = await request(app).post('/api/v2/auth/login').send(body);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(() => jwt.verify(first.body.token as string, env.JWT_SECRET)).not.toThrow();
      expect(() => jwt.verify(second.body.token as string, env.JWT_SECRET)).not.toThrow();
      // Intentionally no assertion that the two token strings differ — see
      // spec.md User Story 1 Scenario 2 / Assumption A3.
    });
  });

  describe('US2: credential and system failures are rejected safely', () => {
    it('returns 401 with a generic message when the email does not exist', async () => {
      const pool = poolReturning([]);
      const { app } = buildTestApp({ pool });

      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({ email: 'missing@example.com', password: PASSWORD });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('帳號或密碼錯誤');
    });

    it('returns the identical 401 body when the email exists but the password is wrong', async () => {
      const pool = poolReturning([buildUserRow()]);
      const { app } = buildTestApp({ pool });

      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({ email: 'user@example.com', password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('帳號或密碼錯誤');
    });

    it('returns 500 with no leaked hash when the stored password is not a supported bcrypt format', async () => {
      const pool = poolReturning([buildUserRow({ password: 'not-a-bcrypt-hash' })]);
      const { app } = buildTestApp({ pool });

      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({ email: 'user@example.com', password: PASSWORD });

      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).not.toContain('not-a-bcrypt-hash');
      expect(res.body.password).toBeUndefined();
    });

    it('returns 500 with a generic body when the repository query fails', async () => {
      const pool = createMockPool({ query: vi.fn().mockRejectedValue(new Error('connection refused')) });
      const { app } = buildTestApp({ pool });

      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({ email: 'user@example.com', password: PASSWORD });

      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).not.toContain('connection refused');
    });

    it('returns 500 when JWT signing fails', async () => {
      const pool = poolReturning([buildUserRow()]);
      const { app } = buildTestApp({ pool });
      const signSpy = vi.spyOn(jwt, 'sign').mockImplementationOnce(() => {
        throw new Error('signing failed');
      });

      try {
        const res = await request(app)
          .post('/api/v2/auth/login')
          .send({ email: 'user@example.com', password: PASSWORD });

        expect(res.status).toBe(500);
      } finally {
        signSpy.mockRestore();
      }
    });

    it('never includes a password or bcrypt-hash-shaped string in any response body', async () => {
      const scenarios: Array<{ pool: ReturnType<typeof createMockPool>; body: Record<string, string> }> = [
        { pool: poolReturning([buildUserRow()]), body: { email: 'user@example.com', password: PASSWORD } },
        { pool: poolReturning([]), body: { email: 'missing@example.com', password: PASSWORD } },
        { pool: poolReturning([buildUserRow()]), body: { email: 'user@example.com', password: 'wrong' } },
        {
          pool: poolReturning([buildUserRow({ password: 'not-a-bcrypt-hash' })]),
          body: { email: 'user@example.com', password: PASSWORD },
        },
      ];

      for (const scenario of scenarios) {
        const { app } = buildTestApp({ pool: scenario.pool });
        const res = await request(app).post('/api/v2/auth/login').send(scenario.body);
        const raw = JSON.stringify(res.body);
        expect(raw).not.toContain(PASSWORD);
        expect(raw).not.toContain(PASSWORD_HASH);
      }
    });
  });

  describe('US3: request validation failures use the Laravel-compatible 422 format', () => {
    it('returns 422 when password is missing', async () => {
      const { app } = buildTestApp();

      const res = await request(app).post('/api/v2/auth/login').send({ email: 'user@example.com' });

      expect(res.status).toBe(422);
      expect(res.body.message).toBe('The given data was invalid.');
      expect(Array.isArray(res.body.errors.password)).toBe(true);
      expect(res.body.code).toBeUndefined();
      expect(res.body.requestId).toBeUndefined();
    });

    it('returns 422 when email format is invalid', async () => {
      const { app } = buildTestApp();

      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({ email: 'not-an-email', password: PASSWORD });

      expect(res.status).toBe(422);
      expect(Array.isArray(res.body.errors.email)).toBe(true);
    });

    it('returns 422 when password is an empty string', async () => {
      const { app } = buildTestApp();

      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({ email: 'user@example.com', password: '' });

      expect(res.status).toBe(422);
      expect(Array.isArray(res.body.errors.password)).toBe(true);
    });

    it('returns 422 and rejects unknown fields outright, keyed by their own field name', async () => {
      const { app } = buildTestApp();

      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({ email: 'user@example.com', password: PASSWORD, remember: true });

      expect(res.status).toBe(422);
      expect(res.body.errors.remember).toEqual(['Unrecognized key: remember']);
      expect(res.body.token).toBeUndefined();
    });
  });
});
