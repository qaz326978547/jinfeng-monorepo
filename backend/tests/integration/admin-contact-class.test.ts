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

/**
 * Serves create() (INSERT + re-SELECT by plain id) and updateActive()
 * (SELECT ... AND del=0 existence check + UPDATE + re-SELECT by plain id).
 * The two SELECT forms differ only by the trailing `AND del = 0`, so they
 * must be matched by exact SQL text, not a shared prefix.
 */
function mockContactClassWritePool(options: { existsForUpdate?: unknown; finalRow: unknown }) {
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    if (sql === 'SELECT * FROM contact_class WHERE id = ? AND del = 0') {
      return Promise.resolve([options.existsForUpdate ? [options.existsForUpdate] : [], []]);
    }
    if (sql.startsWith('INSERT INTO contact_class')) {
      return Promise.resolve([{ insertId: (options.finalRow as { id: number }).id, affectedRows: 1 }, []]);
    }
    if (sql.startsWith('UPDATE contact_class')) {
      return Promise.resolve([{ affectedRows: 1 }, []]);
    }
    if (sql === 'SELECT * FROM contact_class WHERE id = ?') {
      return Promise.resolve([[options.finalRow], []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return { pool: createMockPool({ query: queryFn }), queryFn };
}

describe('POST /api/v2/admin/contact-class', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();

    const res = await request(app).post('/api/v2/admin/contact-class').send({ name: 'x', no: 1 });

    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/contact-class')
      .set('Authorization', `Bearer ${normalUserToken()}`)
      .send({ name: 'x', no: 1 });

    expect(res.status).toBe(403);
  });

  it('returns 201 {message, data} on success', async () => {
    const row = contactClassRow({ id: 5, name: '新分類', no: 20 });
    const { pool } = mockContactClassWritePool({ finalRow: row });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .post('/api/v2/admin/contact-class')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: '新分類', no: 20 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: '新增成功', data: row });
  });

  it('never includes del in the INSERT — lets the DB DEFAULT 0 apply', async () => {
    const row = contactClassRow({ id: 5 });
    const { pool, queryFn } = mockContactClassWritePool({ finalRow: row });
    const { app } = buildTestApp({ pool });

    await request(app)
      .post('/api/v2/admin/contact-class')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: '新分類', no: 20 });

    const insertCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      sql.startsWith('INSERT INTO contact_class'),
    );
    expect(insertCall?.[0]).toBe('INSERT INTO contact_class (name, no) VALUES (?, ?)');
    expect(insertCall?.[1]).toEqual(['新分類', 20]);
  });

  it('rejects a missing name with the FormRequest-compatible 400 shape', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/contact-class')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ no: 20 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'name 為必填欄位' });
  });

  it('rejects a missing no', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/contact-class')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: 'x' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'no 為必填欄位' });
  });

  it('rejects a non-numeric no', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/contact-class')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: 'x', no: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });
});

describe('PUT /api/v2/admin/contact-class/{id}', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();

    const res = await request(app).put('/api/v2/admin/contact-class/1').send({ name: 'x', no: 1 });

    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .put('/api/v2/admin/contact-class/1')
      .set('Authorization', `Bearer ${normalUserToken()}`)
      .send({ name: 'x', no: 1 });

    expect(res.status).toBe(403);
  });

  it('returns 200 {message, data} with the updated fields on success', async () => {
    const existing = contactClassRow({ id: 1, name: '舊名稱', no: 10 });
    const updated = contactClassRow({ id: 1, name: '新名稱', no: 99 });
    const { pool } = mockContactClassWritePool({ existsForUpdate: existing, finalRow: updated });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .put('/api/v2/admin/contact-class/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: '新名稱', no: 99 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: '更新成功', data: updated });
  });

  it('writes only name/no — never del', async () => {
    const existing = contactClassRow({ id: 1 });
    const updated = contactClassRow({ id: 1, name: '新名稱', no: 99 });
    const { pool, queryFn } = mockContactClassWritePool({ existsForUpdate: existing, finalRow: updated });
    const { app } = buildTestApp({ pool });

    await request(app)
      .put('/api/v2/admin/contact-class/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: '新名稱', no: 99 });

    const updateCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      sql.startsWith('UPDATE contact_class'),
    );
    expect(updateCall?.[0]).toBe('UPDATE contact_class SET name = ?, no = ? WHERE id = ?');
    expect(updateCall?.[1]).toEqual(['新名稱', 99, 1]);
  });

  it('returns 404 for a nonexistent id and never issues an UPDATE', async () => {
    const { pool, queryFn } = mockContactClassWritePool({ finalRow: contactClassRow() });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .put('/api/v2/admin/contact-class/999')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: 'x', no: 1 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '找不到資料' });
    const updateCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      sql.startsWith('UPDATE contact_class'),
    );
    expect(updateCall).toBeUndefined();
  });

  it('returns 404 for a row that exists but has del=1', async () => {
    // existsForUpdate omitted -> findByIdActive's WHERE del=0 finds nothing, same as a nonexistent id.
    const { pool } = mockContactClassWritePool({ finalRow: contactClassRow() });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .put('/api/v2/admin/contact-class/2')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: 'x', no: 1 });

    expect(res.status).toBe(404);
  });

  it('rejects a missing name', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .put('/api/v2/admin/contact-class/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ no: 1 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'name 為必填欄位' });
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
    if (sql.startsWith('SELECT id FROM contact_class WHERE id IN')) {
      return Promise.resolve([existingIds.map((id) => ({ id })), []]);
    }
    if (sql.startsWith('DELETE FROM contact_class WHERE id IN')) {
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

describe('DELETE /api/v2/admin/contact-class', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();

    const res = await request(app).delete('/api/v2/admin/contact-class').send({ ids: [1] });

    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .delete('/api/v2/admin/contact-class')
      .set('Authorization', `Bearer ${normalUserToken()}`)
      .send({ ids: [1] });

    expect(res.status).toBe(403);
  });

  it('deletes a single id', async () => {
    const connection = mockDeleteConnection([1]);
    const { app } = buildTestApp({ pool: poolWithConnection(connection) });

    const res = await request(app)
      .delete('/api/v2/admin/contact-class')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ ids: [1] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: '刪除成功' });
  });

  it('deletes multiple ids in one batch', async () => {
    const connection = mockDeleteConnection([1, 2, 3]);
    const { app } = buildTestApp({ pool: poolWithConnection(connection) });

    const res = await request(app)
      .delete('/api/v2/admin/contact-class')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ ids: [1, 2, 3] });

    expect(res.status).toBe(200);
    const deleteCall = (connection.query.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      sql.startsWith('DELETE FROM contact_class'),
    );
    expect(deleteCall?.[1]).toEqual([1, 2, 3]);
  });

  it('returns 404 and deletes nothing (atomic) when any id in the batch is missing', async () => {
    const connection = mockDeleteConnection([1]);
    const { app } = buildTestApp({ pool: poolWithConnection(connection) });

    const res = await request(app)
      .delete('/api/v2/admin/contact-class')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ ids: [1, 2] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '以下的 id 不存在: 2' });
    const deleteCalls = (connection.query.mock.calls as [string, unknown[]?][]).filter(([sql]) =>
      sql.startsWith('DELETE FROM contact_class'),
    );
    expect(deleteCalls).toHaveLength(0);
  });

  it('really deletes the row (DELETE FROM), not a soft del=1 update — known-legacy-issues.md #10 preserved as hard delete', async () => {
    const connection = mockDeleteConnection([1]);
    const { app } = buildTestApp({ pool: poolWithConnection(connection) });

    await request(app)
      .delete('/api/v2/admin/contact-class')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ ids: [1] });

    const calls = connection.query.mock.calls as [string, unknown[]?][];
    expect(calls.some(([sql]) => sql.includes('UPDATE') && sql.includes('del'))).toBe(false);
    expect(calls.some(([sql]) => sql.startsWith('DELETE FROM contact_class'))).toBe(true);
  });

  it.each([{ ids: [] }, { ids: 0 }, { ids: -1 }, { ids: 'abc' }, { ids: ['1', '2'] }])(
    'rejects an invalid ids payload %j with a 400',
    async (payload) => {
      const { app } = buildTestApp();

      const res = await request(app)
        .delete('/api/v2/admin/contact-class')
        .set('Authorization', `Bearer ${adminUserToken()}`)
        .send(payload);

      expect(res.status).toBe(400);
    },
  );
});
