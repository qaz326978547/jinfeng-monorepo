import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';
import { adminUserToken, normalUserToken } from '../helpers/auth-tokens';

function contactClassRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: '勞資爭議',
    no: 10,
    del: 0,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
    ...overrides,
  };
}

describe('GET /api/v2/admin/contact-class/{id} — authorization', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/v2/admin/contact-class/1');

    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .get('/api/v2/admin/contact-class/1')
      .set('Authorization', `Bearer ${normalUserToken()}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v2/admin/contact-class/{id}', () => {
  it('returns 200 with the full row for an admin token', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[contactClassRow()], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact-class/1')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(contactClassRow());
  });

  it('queries WHERE id = ? AND del = 0', async () => {
    const queryFn = vi.fn().mockResolvedValue([[contactClassRow()], []]);
    const pool = createMockPool({ query: queryFn });
    const { app } = buildTestApp({ pool });

    await request(app)
      .get('/api/v2/admin/contact-class/1')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(queryFn).toHaveBeenCalledWith('SELECT * FROM contact_class WHERE id = ? AND del = 0', [
      1,
    ]);
  });

  it('returns 404 {message} (no code/requestId) for a nonexistent id', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact-class/999')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '找不到資料' });
  });

  it('returns 404 for a row that exists but has del=1 (soft-deleted)', async () => {
    // WHERE del = 0 is baked into the SQL, so a del=1 row simply never comes back.
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact-class/2')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(404);
  });
});
