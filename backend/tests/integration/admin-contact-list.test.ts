import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';
import { adminUserToken, normalUserToken } from '../helpers/auth-tokens';

function contactListRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: '王小明',
    cel: '0912345678',
    job: '經理',
    email: 'test@example.com',
    no: 0,
    cid: 1,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
    ...overrides,
  };
}

describe('Admin contact-list endpoints — authorization', () => {
  it.each([
    ['GET', '/api/v2/admin/contact-list'],
    ['GET', '/api/v2/admin/contact-list/1'],
  ])('%s %s returns 401 with no Authorization header', async (method, path) => {
    const { app } = buildTestApp();

    const res = await request(app)[method.toLowerCase() as 'get'](path);

    expect(res.status).toBe(401);
  });

  it.each([
    ['GET', '/api/v2/admin/contact-list'],
    ['GET', '/api/v2/admin/contact-list/1'],
  ])('%s %s returns 403 for a valid but non-admin token', async (method, path) => {
    const { app } = buildTestApp();

    const res = await request(app)
      [method.toLowerCase() as 'get'](path)
      .set('Authorization', `Bearer ${normalUserToken()}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v2/admin/contact-list', () => {
  it('returns 200 {data: [...]} for an admin token', async () => {
    const rows = [contactListRow()];
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([rows, []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact-list')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: rows });
  });

  it('issues an unfiltered, unordered SELECT * FROM contact_list', async () => {
    const queryFn = vi.fn().mockResolvedValue([[], []]);
    const pool = createMockPool({ query: queryFn });
    const { app } = buildTestApp({ pool });

    await request(app)
      .get('/api/v2/admin/contact-list')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(queryFn).toHaveBeenCalledWith('SELECT * FROM contact_list');
  });

  it('returns {data: []} when the table is empty', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact-list')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
  });
});

describe('GET /api/v2/admin/contact-list/{id}', () => {
  it('returns 200 with the full row for an existing id', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[contactListRow()], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact-list/1')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(contactListRow());
  });

  it('returns the legacy-compatible 404 {message} for a nonexistent id', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact-list/999')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '找不到資料' });
  });
});
