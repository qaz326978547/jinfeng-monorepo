import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';

const PASSWORD = 'correct-password';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: '王小明',
    email: 'new-user@example.com',
    password: PASSWORD,
    password_confirmation: PASSWORD,
    ...overrides,
  };
}

interface DuplicateKeyError extends Error {
  code: string;
  sqlMessage: string;
}

function duplicateEmailError(): DuplicateKeyError {
  const error = new Error(
    "Duplicate entry 'new-user@example.com' for key 'users.users_email_unique'",
  ) as DuplicateKeyError;
  error.code = 'ER_DUP_ENTRY';
  error.sqlMessage = error.message;
  return error;
}

describe('POST /api/v2/auth/register', () => {
  it('returns 201 with exactly {message:"註冊成功"} — no token, no user data', async () => {
    const pool = createMockPool({
      query: vi.fn().mockResolvedValue([{ insertId: 1, affectedRows: 1 }, []]),
    });
    const { app } = buildTestApp({ pool });

    const res = await request(app).post('/api/v2/auth/register').send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: '註冊成功' });
  });

  it('never returns or logs the plaintext password or its hash', async () => {
    let capturedHash = '';
    const pool = createMockPool({
      query: vi.fn().mockImplementation((_sql: string, params?: unknown[]) => {
        capturedHash = params?.[2] as string;
        return Promise.resolve([{ insertId: 1, affectedRows: 1 }, []]);
      }),
    });
    const { app } = buildTestApp({ pool });

    const res = await request(app).post('/api/v2/auth/register').send(validPayload());

    expect(res.status).toBe(201);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(PASSWORD);
    expect(raw).not.toContain(capturedHash);
    expect(capturedHash).not.toBe(PASSWORD);
  });

  it('rejects a password_confirmation that does not match password', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/auth/register')
      .send(validPayload({ password_confirmation: 'something-else' }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'password_confirmation 與 password 不一致' });
  });

  it('rejects a missing required field (name)', async () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).name;
    const { app } = buildTestApp();

    const res = await request(app).post('/api/v2/auth/register').send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'name 為必填欄位' });
  });

  it('rejects an invalid email format', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/auth/register')
      .send(validPayload({ email: 'not-an-email' }));

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('email');
  });

  it('rejects a password shorter than 6 characters', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/auth/register')
      .send(validPayload({ password: 'ab1', password_confirmation: 'ab1' }));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('password');
  });

  it('returns 400 {status:"error"} on duplicate email, without misreporting an unrelated constraint as email conflict', async () => {
    const pool = createMockPool({ query: vi.fn().mockRejectedValue(duplicateEmailError()) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).post('/api/v2/auth/register').send(validPayload());

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'email 已被使用' });
  });

  it('does not treat every ER_DUP_ENTRY as a duplicate email (returns 500 for an unrelated constraint)', async () => {
    const unrelatedError = new Error(
      "Duplicate entry '5' for key 'some_other_table.some_other_unique_key'",
    ) as DuplicateKeyError;
    unrelatedError.code = 'ER_DUP_ENTRY';
    unrelatedError.sqlMessage = unrelatedError.message;
    const pool = createMockPool({ query: vi.fn().mockRejectedValue(unrelatedError) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).post('/api/v2/auth/register').send(validPayload());

    expect(res.status).toBe(500);
  });

  it('omits is_admin from the INSERT when not provided, leaving the column DEFAULT 0 to apply', async () => {
    const queryFn = vi.fn().mockResolvedValue([{ insertId: 1, affectedRows: 1 }, []]);
    const pool = createMockPool({ query: queryFn });
    const { app } = buildTestApp({ pool });

    const res = await request(app).post('/api/v2/auth/register').send(validPayload());

    expect(res.status).toBe(201);
    const [sql, params] = queryFn.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('is_admin');
    expect(params).toHaveLength(3); // name, email, password only
  });

  it('writes is_admin when explicitly provided', async () => {
    const queryFn = vi.fn().mockResolvedValue([{ insertId: 1, affectedRows: 1 }, []]);
    const pool = createMockPool({ query: queryFn });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .post('/api/v2/auth/register')
      .send(validPayload({ is_admin: true }));

    expect(res.status).toBe(201);
    const [sql, params] = queryFn.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('is_admin');
    expect(params).toEqual(expect.arrayContaining([1]));
  });

  it('registers then logs in with the same password (round trip through the real bcrypt hash)', async () => {
    let capturedHash = '';
    const queryFn = vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.startsWith('INSERT INTO users')) {
        capturedHash = params?.[2] as string;
        return Promise.resolve([{ insertId: 7, affectedRows: 1 }, []]);
      }
      if (sql.startsWith('SELECT id, email, password, is_admin FROM users')) {
        return Promise.resolve([
          [{ id: 7, email: 'new-user@example.com', password: capturedHash, is_admin: 0 }],
          [],
        ]);
      }
      throw new Error(`unexpected query in test: ${sql}`);
    });
    const pool = createMockPool({ query: queryFn });
    const { app } = buildTestApp({ pool });

    const registerRes = await request(app).post('/api/v2/auth/register').send(validPayload());
    expect(registerRes.status).toBe(201);
    expect(capturedHash).toMatch(/^\$2[aby]\$\d{2}\$/);

    const loginRes = await request(app)
      .post('/api/v2/auth/login')
      .send({ email: 'new-user@example.com', password: PASSWORD });

    expect(loginRes.status).toBe(200);
    expect(typeof loginRes.body.token).toBe('string');
  });
});
