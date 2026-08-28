import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';

const JWT_SECRET = 'test-only-secret-not-for-real-use'; // matches TEST_ENV_SOURCE in build-test-app.ts

function validToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    { sub: 1, email: 'user@example.com', isAdmin: false, ...overrides },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

/**
 * Stateless logout (specs/backend/laravel-to-node-parity.md §10.9/§10.11):
 * this whole suite exercises `authenticate` + the logout handler through the
 * real route, since logout itself has no business logic beyond "did
 * authenticate() let this request through".
 */
describe('POST /api/v2/auth/logout', () => {
  it('returns 200 {message:"登出成功"} for a valid token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/auth/logout')
      .set('Authorization', `Bearer ${validToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: '登出成功' });
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const { app } = buildTestApp();

    const res = await request(app).post('/api/v2/auth/logout');

    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed/invalid token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/auth/logout')
      .set('Authorization', 'Bearer not-a-real-jwt');

    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const { app } = buildTestApp();
    const expiredToken = jwt.sign(
      { sub: 1, email: 'user@example.com', isAdmin: false },
      JWT_SECRET,
      { expiresIn: -10 }, // already expired 10s ago
    );

    const res = await request(app)
      .post('/api/v2/auth/logout')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it('does not touch the database — logout is pure JWT verification, no DB write', async () => {
    const queryFn = vi.fn();
    const pool = createMockPool({ query: queryFn });
    const { app } = buildTestApp({ pool });

    await request(app).post('/api/v2/auth/logout').set('Authorization', `Bearer ${validToken()}`);

    expect(queryFn).not.toHaveBeenCalled();
  });

  it('intentional stateless-logout trade-off: the same still-unexpired token is accepted again after "logout"', async () => {
    const { app } = buildTestApp();
    const token = validToken();

    const first = await request(app)
      .post('/api/v2/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    const second = await request(app)
      .post('/api/v2/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200); // NOT revoked — see §10.11: revocation is explicitly out of scope
  });
});
