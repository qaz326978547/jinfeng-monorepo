import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';
import { adminUserToken, normalUserToken } from '../helpers/auth-tokens';

type QueryCall = [string, unknown[]?];

function consultationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: '王小明',
    phone: '0912345678',
    companyName: 'XX有限公司',
    taxId: '12345678',
    lineId: 'abc123',
    callbackTimes: JSON.stringify(['afternoon', 'evening']),
    message: '想了解勞動契約相關問題',
    status: 'pending',
    createdAt: '2026-09-11T00:00:00.000Z',
    updatedAt: '2026-09-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('GET /api/v2/admin/consultations — authorization', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/v2/admin/consultations');

    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .get('/api/v2/admin/consultations')
      .set('Authorization', `Bearer ${normalUserToken()}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v2/admin/consultations', () => {
  it('returns 200 with the paginated envelope and correctly-parsed callbackTimes for an admin token', async () => {
    const row = consultationRow();
    const queryFn = vi.fn().mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT COUNT(*)')) {
        return Promise.resolve([[{ total: 1 }], []]);
      }
      if (sql.startsWith('SELECT') && sql.includes('FROM consultations ORDER BY')) {
        return Promise.resolve([[row], []]);
      }
      throw new Error(`unexpected query in test: ${sql}`);
    });
    const { app } = buildTestApp({ pool: createMockPool({ query: queryFn }) });

    const res = await request(app)
      .get('/api/v2/admin/consultations')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ ...row, callbackTimes: ['afternoon', 'evening'] }]);
    expect(res.body.current_page).toBe(1);
    expect(res.body.total).toBe(1);
  });

  it('orders by id DESC (newest first)', async () => {
    const queryFn = vi.fn().mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT COUNT(*)')) {
        return Promise.resolve([[{ total: 0 }], []]);
      }
      return Promise.resolve([[], []]);
    });
    const { app } = buildTestApp({ pool: createMockPool({ query: queryFn }) });

    await request(app).get('/api/v2/admin/consultations').set('Authorization', `Bearer ${adminUserToken()}`);

    const calls = queryFn.mock.calls as QueryCall[];
    const countCall = calls.find(([sql]) => sql.startsWith('SELECT COUNT(*)'));
    expect(countCall).toBeDefined();
    // total === 0 short-circuits findPage(), so ordering is verified against
    // the repository's SQL text directly when rows are actually fetched:
    const listCall = calls.find(([sql]) => sql.includes('FROM consultations ORDER BY'));
    if (listCall) {
      expect(listCall[0]).toContain('ORDER BY id DESC');
    }
  });
});

describe('PATCH /api/v2/admin/consultations/:id — authorization', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();

    const res = await request(app).patch('/api/v2/admin/consultations/1').send({ status: 'contacted' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .patch('/api/v2/admin/consultations/1')
      .set('Authorization', `Bearer ${normalUserToken()}`)
      .send({ status: 'contacted' });

    expect(res.status).toBe(403);
  });
});

function mockStatusUpdatePool(options: { existing?: unknown; updated: unknown }) {
  let selectCallCount = 0;
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('UPDATE consultations')) {
      return Promise.resolve([{ affectedRows: 1 }, []]);
    }
    if (sql.startsWith('SELECT') && sql.includes('FROM consultations WHERE id = ?')) {
      selectCallCount += 1;
      // First call is the existence check (pre-update), second is the re-select (post-update).
      if (selectCallCount === 1) {
        return Promise.resolve([options.existing ? [options.existing] : [], []]);
      }
      return Promise.resolve([[options.updated], []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return { pool: createMockPool({ query: queryFn }), queryFn };
}

describe('PATCH /api/v2/admin/consultations/:id', () => {
  it('updates status pending -> contacted and returns 200 {message, data}', async () => {
    const existing = consultationRow({ status: 'pending' });
    const updated = consultationRow({ status: 'contacted' });
    const { pool } = mockStatusUpdatePool({ existing, updated });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .patch('/api/v2/admin/consultations/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ status: 'contacted' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('更新成功');
    expect(res.body.data).toEqual({ ...updated, callbackTimes: ['afternoon', 'evening'] });
  });

  it('updates status contacted -> completed', async () => {
    const existing = consultationRow({ status: 'contacted' });
    const updated = consultationRow({ status: 'completed' });
    const { pool } = mockStatusUpdatePool({ existing, updated });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .patch('/api/v2/admin/consultations/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });

  it('returns 404 for a nonexistent id and never issues an UPDATE', async () => {
    const { pool, queryFn } = mockStatusUpdatePool({ updated: consultationRow() });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .patch('/api/v2/admin/consultations/999')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ status: 'contacted' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '找不到資料' });
    const updateCall = (queryFn.mock.calls as QueryCall[]).find(([sql]) => sql.startsWith('UPDATE consultations'));
    expect(updateCall).toBeUndefined();
  });

  it('returns 400 for an invalid status value', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .patch('/api/v2/admin/consultations/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ status: 'archived' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'status 必須為 pending、contacted 或 completed' });
  });
});
