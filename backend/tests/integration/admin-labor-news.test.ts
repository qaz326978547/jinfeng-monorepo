import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';
import { adminUserToken, normalUserToken } from '../helpers/auth-tokens';

function newsRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: '台南 廟祝被炒魷魚 討加班費',
    sourceName: '中國時報',
    sourceUrl: 'https://www.chinatimes.com/example',
    publishedAt: '2026-08-29',
    sortOrder: 1,
    isActive: 1,
    createdAt: '2026-08-29 00:00:00',
    updatedAt: '2026-08-29 00:00:00',
    ...overrides,
  };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: '台南 廟祝被炒魷魚 討加班費',
    sourceName: '中國時報',
    sourceUrl: 'https://www.chinatimes.com/example',
    publishedAt: '2026-08-29',
    sortOrder: 1,
    isActive: true,
    ...overrides,
  };
}

function mockLaborNewsListPool(options: { total: number; rows: unknown[] }) {
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('SELECT COUNT(*)')) {
      return Promise.resolve([[{ total: options.total }], []]);
    }
    if ((sql.includes('FROM labor_news') && !sql.includes('COUNT') && !sql.includes('WHERE id = ?'))) {
      return Promise.resolve([options.rows, []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return { pool: createMockPool({ query: queryFn }), queryFn };
}

describe('GET /api/v2/admin/labor-news', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/v2/admin/labor-news');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .get('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${normalUserToken()}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with a pagination envelope including inactive rows, for an admin token', async () => {
    const rows = [newsRow({ isActive: 0 })];
    const { pool } = mockLaborNewsListPool({ total: 1, rows });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ ...rows[0], isActive: false }]);
    expect(res.body.total).toBe(1);
  });

  it('lists no is_active filter — admin sees active and inactive alike', async () => {
    const { pool, queryFn } = mockLaborNewsListPool({ total: 0, rows: [] });
    const { app } = buildTestApp({ pool });

    await request(app)
      .get('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    const countCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      sql.startsWith('SELECT COUNT(*)'),
    );
    expect(countCall?.[0]).toBe('SELECT COUNT(*) AS total FROM labor_news');
  });

  it('returns admin rows in sort_order ASC / publishedAt DESC / id DESC order: B, C, A', async () => {
    const a = newsRow({ id: 1, sortOrder: 3 });
    const b = newsRow({ id: 2, sortOrder: 1 });
    const c = newsRow({ id: 3, sortOrder: 2 });
    // The (mocked) DB is the one that actually sorts — see the ORDER BY assertion below —
    // rows here simulate what MySQL would already have returned in that order.
    const { pool, queryFn } = mockLaborNewsListPool({ total: 3, rows: [b, c, a] });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.body.data.map((row: { id: number }) => row.id)).toEqual([2, 3, 1]);
    const selectCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      (sql.includes('FROM labor_news') && !sql.includes('COUNT') && !sql.includes('WHERE id = ?')),
    );
    expect(selectCall?.[0]).toContain('ORDER BY sort_order ASC, published_at DESC, id DESC');
  });
});

function mockLaborNewsCreatePool(finalRow: Record<string, unknown>) {
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('INSERT INTO labor_news')) {
      return Promise.resolve([{ insertId: finalRow.id, affectedRows: 1 }, []]);
    }
    if (sql.includes('FROM labor_news WHERE id = ?')) {
      return Promise.resolve([[finalRow], []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return { pool: createMockPool({ query: queryFn }), queryFn };
}

function mockLaborNewsUpdatePool(options: { existsForUpdate: unknown; finalRow: unknown }) {
  let selectCallCount = 0;
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('UPDATE labor_news')) {
      return Promise.resolve([{ affectedRows: 1 }, []]);
    }
    if (sql.includes('FROM labor_news WHERE id = ?')) {
      selectCallCount += 1;
      if (selectCallCount === 1) {
        return Promise.resolve([options.existsForUpdate ? [options.existsForUpdate] : [], []]);
      }
      return Promise.resolve([[options.finalRow], []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return { pool: createMockPool({ query: queryFn }), queryFn };
}

describe('POST /api/v2/admin/labor-news', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/api/v2/admin/labor-news').send(validPayload());
    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${normalUserToken()}`)
      .send(validPayload());
    expect(res.status).toBe(403);
  });

  it('returns 201 { message, data } on success (admin, valid payload)', async () => {
    const row = newsRow({ id: 5, isActive: 1 });
    const { pool } = mockLaborNewsCreatePool(row);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .post('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: '新增成功', data: { ...row, isActive: true } });
  });

  it('creates with isActive=false when the payload disables it', async () => {
    const row = newsRow({ id: 6, isActive: 0 });
    const { pool, queryFn } = mockLaborNewsCreatePool(row);
    const { app } = buildTestApp({ pool });

    await request(app)
      .post('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ isActive: false }));

    const insertCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      sql.startsWith('INSERT INTO labor_news'),
    );
    expect(insertCall?.[1]).toEqual([
      '台南 廟祝被炒魷魚 討加班費',
      '中國時報',
      'https://www.chinatimes.com/example',
      '2026-08-29',
      1,
      0,
    ]);
  });

  it('rejects a sourceUrl without http(s)://', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ sourceUrl: 'not-a-url' }));

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('rejects an invalid calendar date (2026-02-30)', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ publishedAt: '2026-02-30' }));

    expect(res.status).toBe(400);
  });

  it('rejects a malformed date string', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ publishedAt: '2026/08/29' }));

    expect(res.status).toBe(400);
  });

  it('rejects a negative sortOrder', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ sortOrder: -1 }));

    expect(res.status).toBe(400);
  });

  it('rejects a decimal sortOrder', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ sortOrder: 1.5 }));

    expect(res.status).toBe(400);
  });

  it('rejects a missing sortOrder', async () => {
    const { app } = buildTestApp();
    const payload = validPayload();
    delete (payload as Record<string, unknown>).sortOrder;

    const res = await request(app)
      .post('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'sortOrder 為必填欄位' });
  });

  it('rejects a NaN-producing sortOrder (string garbage)', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ sortOrder: 'not-a-number' }));

    expect(res.status).toBe(400);
  });

  it('rejects a missing title', async () => {
    const { app } = buildTestApp();
    const payload = validPayload();
    delete (payload as Record<string, unknown>).title;

    const res = await request(app)
      .post('/api/v2/admin/labor-news')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'title 為必填欄位' });
  });
});

describe('PUT /api/v2/admin/labor-news/{id}', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();
    const res = await request(app).put('/api/v2/admin/labor-news/1').send(validPayload());
    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .put('/api/v2/admin/labor-news/1')
      .set('Authorization', `Bearer ${normalUserToken()}`)
      .send(validPayload());
    expect(res.status).toBe(403);
  });

  it('returns 200 { message, data } on success, including an updated sortOrder', async () => {
    const existing = newsRow({ id: 1, sortOrder: 1 });
    const updated = newsRow({ id: 1, sortOrder: 5 });
    const { pool } = mockLaborNewsUpdatePool({ existsForUpdate: existing, finalRow: updated });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .put('/api/v2/admin/labor-news/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ sortOrder: 5 }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: '更新成功', data: { ...updated, isActive: true } });
  });

  it('toggles isActive to false (disable) via update', async () => {
    const existing = newsRow({ id: 1, isActive: 1 });
    const updated = newsRow({ id: 1, isActive: 0 });
    const { pool } = mockLaborNewsUpdatePool({ existsForUpdate: existing, finalRow: updated });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .put('/api/v2/admin/labor-news/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ isActive: false }));

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('returns 404 for a nonexistent id and never issues an UPDATE', async () => {
    const { pool, queryFn } = mockLaborNewsUpdatePool({
      existsForUpdate: null,
      finalRow: newsRow(),
    });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .put('/api/v2/admin/labor-news/999')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '找不到資料' });
    expect(queryFn.mock.calls.some(([sql]) => (sql as string).startsWith('UPDATE labor_news'))).toBe(
      false,
    );
  });

  it('rejects a non-integer id in the path', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .put('/api/v2/admin/labor-news/abc')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload());

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v2/admin/labor-news/{id}', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();
    const res = await request(app).delete('/api/v2/admin/labor-news/1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .delete('/api/v2/admin/labor-news/1')
      .set('Authorization', `Bearer ${normalUserToken()}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 on success', async () => {
    const queryFn = vi.fn().mockResolvedValue([{ affectedRows: 1 }, []]);
    const { app } = buildTestApp({ pool: createMockPool({ query: queryFn }) });

    const res = await request(app)
      .delete('/api/v2/admin/labor-news/1')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: '刪除成功' });
  });

  it('returns 404 when the row does not exist', async () => {
    const queryFn = vi.fn().mockResolvedValue([{ affectedRows: 0 }, []]);
    const { app } = buildTestApp({ pool: createMockPool({ query: queryFn }) });

    const res = await request(app)
      .delete('/api/v2/admin/labor-news/999')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '找不到資料' });
  });
});
