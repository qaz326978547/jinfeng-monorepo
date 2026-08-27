import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';
import { adminUserToken, normalUserToken } from '../helpers/auth-tokens';

function faqRow(overrides: Record<string, unknown> = {}) {
  return { id: 1, name: '常見問題', info: '<p>詳解...</p>', no: 10, ...overrides };
}

describe('GET /api/v2/admin/faq', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/v2/admin/faq');

    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .get('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${normalUserToken()}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 { data: [...] } for an admin token', async () => {
    const rows = [faqRow()];
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([rows, []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: rows });
  });

  it('issues the same SELECT ... ORDER BY no DESC as the public endpoint (no del filter)', async () => {
    const queryFn = vi.fn().mockResolvedValue([[], []]);
    const pool = createMockPool({ query: queryFn });
    const { app } = buildTestApp({ pool });

    await request(app).get('/api/v2/admin/faq').set('Authorization', `Bearer ${adminUserToken()}`);

    expect(queryFn).toHaveBeenCalledWith('SELECT id, name, info, no FROM faq ORDER BY no DESC');
  });

  it('returns { data: [] } when the table is empty', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
  });
});

/**
 * Serves create() (INSERT + re-SELECT by id) and update() (SELECT existence
 * check + UPDATE + re-SELECT by id). Both SELECT forms share identical SQL
 * text (`findById` has no del filter, unlike contact_class), so results are
 * distinguished by call order instead of SQL text.
 */
function mockFaqCreatePool(finalRow: Record<string, unknown>) {
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('INSERT INTO faq')) {
      return Promise.resolve([{ insertId: finalRow.id, affectedRows: 1 }, []]);
    }
    if (sql === 'SELECT id, name, info, no FROM faq WHERE id = ?') {
      return Promise.resolve([[finalRow], []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return { pool: createMockPool({ query: queryFn }), queryFn };
}

function mockFaqUpdatePool(options: { existsForUpdate: unknown; finalRow: unknown }) {
  let selectCallCount = 0;
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('UPDATE faq')) {
      return Promise.resolve([{ affectedRows: 1 }, []]);
    }
    if (sql === 'SELECT id, name, info, no FROM faq WHERE id = ?') {
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

describe('POST /api/v2/admin/faq', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/faq')
      .send({ name: 'x', info: 'y', no: 1 });

    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${normalUserToken()}`)
      .send({ name: 'x', info: 'y', no: 1 });

    expect(res.status).toBe(403);
  });

  it('returns 201 { message, data } on success', async () => {
    const row = faqRow({ id: 5, name: '新問題', info: '新解答', no: 20 });
    const { pool } = mockFaqCreatePool(row);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .post('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: '新問題', info: '新解答', no: 20 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: '新增成功', data: row });
  });

  it('never includes del in the INSERT — lets the DB DEFAULT apply', async () => {
    const row = faqRow({ id: 5 });
    const { pool, queryFn } = mockFaqCreatePool(row);
    const { app } = buildTestApp({ pool });

    await request(app)
      .post('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: '新問題', info: '新解答', no: 20 });

    const insertCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      sql.startsWith('INSERT INTO faq'),
    );
    expect(insertCall?.[0]).toBe('INSERT INTO faq (name, info, no) VALUES (?, ?, ?)');
    expect(insertCall?.[1]).toEqual(['新問題', '新解答', 20]);
  });

  it('rejects a missing name with the FormRequest-compatible 400 shape', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ info: 'y', no: 20 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'name 為必填欄位' });
  });

  it('rejects a missing info', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: 'x', no: 20 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'info 為必填欄位' });
  });

  it('rejects a missing no', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: 'x', info: 'y' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'no 為必填欄位' });
  });

  it('rejects a non-numeric no', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: 'x', info: 'y', no: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });
});

describe('PUT /api/v2/admin/faq/{id}', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .put('/api/v2/admin/faq/1')
      .send({ name: 'x', info: 'y', no: 1 });

    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .put('/api/v2/admin/faq/1')
      .set('Authorization', `Bearer ${normalUserToken()}`)
      .send({ name: 'x', info: 'y', no: 1 });

    expect(res.status).toBe(403);
  });

  it('returns 200 { message, data } with the updated fields on success', async () => {
    const existing = faqRow({ id: 1, name: '舊問題', info: '舊解答', no: 10 });
    const updated = faqRow({ id: 1, name: '新問題', info: '新解答', no: 99 });
    const { pool } = mockFaqUpdatePool({ existsForUpdate: existing, finalRow: updated });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .put('/api/v2/admin/faq/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: '新問題', info: '新解答', no: 99 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: '更新成功', data: updated });
  });

  it('writes only name/info/no — never id or del', async () => {
    const existing = faqRow({ id: 1 });
    const updated = faqRow({ id: 1, name: '新問題', info: '新解答', no: 99 });
    const { pool, queryFn } = mockFaqUpdatePool({ existsForUpdate: existing, finalRow: updated });
    const { app } = buildTestApp({ pool });

    await request(app)
      .put('/api/v2/admin/faq/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: '新問題', info: '新解答', no: 99 });

    const updateCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      sql.startsWith('UPDATE faq'),
    );
    expect(updateCall?.[0]).toBe('UPDATE faq SET name = ?, info = ?, no = ? WHERE id = ?');
    expect(updateCall?.[1]).toEqual(['新問題', '新解答', 99, 1]);
  });

  it('returns 404 for a nonexistent id and never issues an UPDATE', async () => {
    const { pool, queryFn } = mockFaqUpdatePool({ existsForUpdate: null, finalRow: faqRow() });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .put('/api/v2/admin/faq/999')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: 'x', info: 'y', no: 1 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '找不到資料' });
    const updateCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      sql.startsWith('UPDATE faq'),
    );
    expect(updateCall).toBeUndefined();
  });

  it('rejects a missing name', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .put('/api/v2/admin/faq/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ info: 'y', no: 1 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'name 為必填欄位' });
  });

  it('rejects a non-integer id in the path', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .put('/api/v2/admin/faq/abc')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: 'x', info: 'y', no: 1 });

    expect(res.status).toBe(400);
  });
});

interface MockConnection {
  query: ReturnType<typeof vi.fn>;
  beginTransaction: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  rollback: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

function mockDeleteConnection(existingIds: number[]): MockConnection {
  const query = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('SELECT id FROM faq WHERE id IN')) {
      return Promise.resolve([existingIds.map((id) => ({ id })), []]);
    }
    if (sql.startsWith('DELETE FROM faq WHERE id IN')) {
      return Promise.resolve([{ affectedRows: existingIds.length }, []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return {
    query,
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
}

function poolWithConnection(connection: MockConnection) {
  return createMockPool({ getConnection: vi.fn().mockResolvedValue(connection) });
}

describe('DELETE /api/v2/admin/faq', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();

    const res = await request(app).delete('/api/v2/admin/faq').send({ ids: [1] });

    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .delete('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${normalUserToken()}`)
      .send({ ids: [1] });

    expect(res.status).toBe(403);
  });

  it('deletes a single id', async () => {
    const connection = mockDeleteConnection([1]);
    const { app } = buildTestApp({ pool: poolWithConnection(connection) });

    const res = await request(app)
      .delete('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ ids: [1] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: '刪除成功' });
  });

  it('deletes multiple ids in one batch', async () => {
    const connection = mockDeleteConnection([1, 2, 3]);
    const { app } = buildTestApp({ pool: poolWithConnection(connection) });

    const res = await request(app)
      .delete('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ ids: [1, 2, 3] });

    expect(res.status).toBe(200);
    const deleteCall = (connection.query.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      sql.startsWith('DELETE FROM faq'),
    );
    expect(deleteCall?.[1]).toEqual([1, 2, 3]);
  });

  it('returns 404 and deletes nothing (atomic) when any id in the batch is missing', async () => {
    const connection = mockDeleteConnection([1]);
    const { app } = buildTestApp({ pool: poolWithConnection(connection) });

    const res = await request(app)
      .delete('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ ids: [1, 2] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '以下的 id 不存在: 2' });
    const deleteCalls = (connection.query.mock.calls as [string, unknown[]?][]).filter(([sql]) =>
      sql.startsWith('DELETE FROM faq'),
    );
    expect(deleteCalls).toHaveLength(0);
  });

  it('returns 404 naming the single missing id for scalar ids payload', async () => {
    const connection = mockDeleteConnection([]);
    const { app } = buildTestApp({ pool: poolWithConnection(connection) });

    const res = await request(app)
      .delete('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ ids: 999 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '找不到 id: 999' });
  });

  it('really deletes the row (DELETE FROM), not a soft del=1 update — confirmed hard delete per known-legacy-issues.md #10', async () => {
    const connection = mockDeleteConnection([1]);
    const { app } = buildTestApp({ pool: poolWithConnection(connection) });

    await request(app)
      .delete('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ ids: [1] });

    const calls = connection.query.mock.calls as [string, unknown[]?][];
    expect(calls.some(([sql]) => sql.includes('UPDATE') && sql.includes('del'))).toBe(false);
    expect(calls.some(([sql]) => sql.startsWith('DELETE FROM faq'))).toBe(true);
  });

  it.each([{ ids: [] }, { ids: 0 }, { ids: -1 }, { ids: 'abc' }, { ids: ['1', '2'] }])(
    'rejects an invalid ids payload %j with a 400',
    async (payload) => {
      const { app } = buildTestApp();

      const res = await request(app)
        .delete('/api/v2/admin/faq')
        .set('Authorization', `Bearer ${adminUserToken()}`)
        .send(payload);

      expect(res.status).toBe(400);
    },
  );
});
