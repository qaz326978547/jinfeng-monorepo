import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';
import { normalUserToken, TEST_JWT_SECRET } from '../helpers/auth-tokens';

/**
 * Security regression (2026-10-26): POST /api/v2/auth/register was public and
 * accepted `is_admin`, so anyone could create an admin account and read every
 * registration. The route is removed; accounts are created by ops in the DB.
 */
const ESCALATION_PAYLOAD = {
  name: 'attacker',
  email: 'attacker@example.com',
  password: 'attacker-password',
  password_confirmation: 'attacker-password',
  is_admin: true,
};

describe('account creation is not reachable without credentials', () => {
  it.each([
    ['POST', '/api/v2/auth/register'],
    ['POST', '/api/v2/auth/register/'],
    ['PUT', '/api/v2/auth/register'],
    ['POST', '/api/v2/register'],
    ['POST', '/api/register'],
  ])('%s %s answers 404 and never touches the database', async (method, path) => {
    const query = vi.fn();
    const getConnection = vi.fn();
    const { app } = buildTestApp({ pool: createMockPool({ query, getConnection }) });

    const res = await request(app)
      [method.toLowerCase() as 'post' | 'put'](path)
      .send(ESCALATION_PAYLOAD);

    expect(res.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
    expect(getConnection).not.toHaveBeenCalled();
  });

  it('rejects is_admin (or any extra field) on login instead of honouring it', async () => {
    const query = vi.fn();
    const { app } = buildTestApp({ pool: createMockPool({ query }) });

    const res = await request(app)
      .post('/api/v2/auth/login')
      .send({ email: 'user@example.com', password: 'whatever', is_admin: true });

    expect(res.status).toBe(422);
    expect(res.body.token).toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });

  it('takes admin rights only from the database row, so a non-admin login gets a non-admin token', async () => {
    const hash = bcrypt.hashSync('correct-password', 4);
    const query = vi
      .fn()
      .mockResolvedValue([
        [{ id: 9, email: 'staff@example.com', password: hash, is_admin: 0 }],
        [],
      ]);
    const { app } = buildTestApp({ pool: createMockPool({ query }) });

    const login = await request(app)
      .post('/api/v2/auth/login')
      .send({ email: 'staff@example.com', password: 'correct-password' });
    expect(login.status).toBe(200);
    const payload = jwt.verify(login.body.token as string, TEST_JWT_SECRET) as { isAdmin: boolean };
    expect(payload.isAdmin).toBe(false);

    const admin = await request(app)
      .get('/api/v2/admin/contact')
      .set('Authorization', `Bearer ${login.body.token as string}`);
    expect(admin.status).toBe(403);
  });

  it('refuses admin endpoints to anonymous callers and to non-admin tokens', async () => {
    const query = vi.fn();
    const { app } = buildTestApp({ pool: createMockPool({ query }) });

    const anonymous = await request(app).get('/api/v2/admin/contact');
    const nonAdmin = await request(app)
      .get('/api/v2/admin/contact')
      .set('Authorization', `Bearer ${normalUserToken()}`);

    expect(anonymous.status).toBe(401);
    expect(nonAdmin.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('still lets an existing admin log in and use admin endpoints', async () => {
    const hash = bcrypt.hashSync('admin-password', 4);
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT id, email, password, is_admin FROM users')) {
        return Promise.resolve([
          [{ id: 3, email: 'admin@example.com', password: hash, is_admin: 1 }],
          [],
        ]);
      }
      if (sql.startsWith('SELECT COUNT(*) AS total FROM contact')) {
        return Promise.resolve([[{ total: 0 }], []]);
      }
      return Promise.resolve([[], []]);
    });
    const { app } = buildTestApp({ pool: createMockPool({ query }) });

    const login = await request(app)
      .post('/api/v2/auth/login')
      .send({ email: 'admin@example.com', password: 'admin-password' });
    expect(login.status).toBe(200);

    const admin = await request(app)
      .get('/api/v2/admin/contact')
      .set('Authorization', `Bearer ${login.body.token as string}`);
    expect(admin.status).toBe(200);
  });
});
