import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';

// Exercises the Zod validate-request middleware through the real
// /api/v2/auth/login route, which is wired with loginRequestSchema and
// legacyErrorFormat: true (spec.md OD-1) — so validation failures on this
// specific route surface as the Laravel-compatible 422 shape, not the
// project's general 400 envelope. See tests/integration/auth-login.test.ts
// for the full set of auth-login contract tests.
describe('validate-request middleware', () => {
  it('rejects a body missing required fields with the 422 Laravel-compatible shape on auth/login', async () => {
    const { app } = buildTestApp();

    const res = await request(app).post('/api/v2/auth/login').send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('The given data was invalid.');
    expect(res.body.code).toBeUndefined();
    expect(Array.isArray(res.body.errors.password)).toBe(true);
  });

  it('passes a valid body through past validation to the real controller/service', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/auth/login')
      .send({ email: 'user@example.com', password: 'password123' });

    // The controller is no longer a 501 stub — with the default mock pool
    // (no matching user row), a well-formed body reaches AuthService and
    // fails credential validation with 401, proving validation itself did
    // not block a well-formed request.
    expect(res.status).toBe(401);
  });

  // Express 5's req.query is a getter that re-parses the URL on every
  // access, so a naive Object.assign(req.query, parsed) silently loses the
  // coerced value on the next read — see validate-request.ts. Exercised
  // through the real /api/v2/contact-quest route (the only current query
  // schema consumer); full behavior coverage lives in
  // tests/integration/contact-quest.test.ts.
  it('persists a coerced query value across the request (Express 5 req.query getter)', async () => {
    const pool = createMockPool({
      query: vi
        .fn()
        .mockImplementation((sql: string) =>
          Promise.resolve(sql.includes('COUNT(*)') ? [[{ total: 0 }], []] : [[], []]),
        ),
    });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-quest?page=2');

    expect(res.status).toBe(200);
    expect(res.body.current_page).toBe(2);
  });
});
