import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';
import { adminUserToken } from '../helpers/auth-tokens';

function faqRow(overrides: Record<string, unknown> = {}) {
  return { id: 1, name: '常見問題', info: '<p>詳解...</p>', no: 10, ...overrides };
}

describe('GET /api/v2/faq', () => {
  it('returns 200 with an array projecting only id/name/info/no', async () => {
    const rows = [faqRow()];
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([rows, []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/faq');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    expect(Object.keys(res.body[0]).sort()).toEqual(['id', 'info', 'name', 'no']);
  });

  it('issues SELECT id, name, info, no FROM faq ORDER BY no DESC with no del filter', async () => {
    const queryFn = vi.fn().mockResolvedValue([[], []]);
    const pool = createMockPool({ query: queryFn });
    const { app } = buildTestApp({ pool });

    await request(app).get('/api/v2/faq');

    expect(queryFn).toHaveBeenCalledWith('SELECT id, name, info, no FROM faq ORDER BY no DESC');
  });

  it('returns [] when the table is empty', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/faq');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('does not require authentication', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/faq');

    expect(res.status).not.toBe(401);
  });
});

/**
 * In-memory fake pool shared between the admin and public routers within a
 * single test, to prove there is no cache layer sitting between an admin
 * write and the public read (no-cache-invalidation-needed-because-there-is-
 * no-cache — see faq.service.ts TODO(parity)).
 */
function createStatefulFaqPool() {
  let rows: { id: number; name: string; info: string; no: number }[] = [];
  let nextId = 1;

  const query = vi.fn().mockImplementation((sql: string, params: unknown[] = []) => {
    if (sql === 'SELECT id, name, info, no FROM faq ORDER BY no DESC') {
      return Promise.resolve([[...rows].sort((a, b) => b.no - a.no), []]);
    }
    if (sql === 'SELECT id, name, info, no FROM faq WHERE id = ?') {
      const row = rows.find((r) => r.id === params[0]);
      return Promise.resolve([row ? [row] : [], []]);
    }
    if (sql === 'INSERT INTO faq (name, info, no) VALUES (?, ?, ?)') {
      const [name, info, no] = params as [string, string, number];
      const id = nextId++;
      rows.push({ id, name, info, no });
      return Promise.resolve([{ insertId: id, affectedRows: 1 }, []]);
    }
    if (sql === 'UPDATE faq SET name = ?, info = ?, no = ? WHERE id = ?') {
      const [name, info, no, id] = params as [string, string, number, number];
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.name = name;
        row.info = info;
        row.no = no;
      }
      return Promise.resolve([{ affectedRows: row ? 1 : 0 }, []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });

  const getConnection = vi.fn().mockResolvedValue({
    query: (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('SELECT id FROM faq WHERE id IN')) {
        const ids = params as number[];
        return Promise.resolve([ids.filter((id) => rows.some((r) => r.id === id)).map((id) => ({ id })), []]);
      }
      if (sql.startsWith('DELETE FROM faq WHERE id IN')) {
        const ids = params as number[];
        rows = rows.filter((r) => !ids.includes(r.id));
        return Promise.resolve([{ affectedRows: ids.length }, []]);
      }
      throw new Error(`unexpected query in test: ${sql}`);
    },
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  });

  return createMockPool({ query, getConnection });
}

describe('Admin FAQ mutations are immediately visible on public GET /faq (no cache layer)', () => {
  it('a newly created FAQ appears on the public list right away', async () => {
    const pool = createStatefulFaqPool();
    const { app } = buildTestApp({ pool });

    await request(app)
      .post('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: '新問題', info: '新解答', no: 5 });

    const res = await request(app).get('/api/v2/faq');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, name: '新問題', info: '新解答', no: 5 }]);
  });

  it('an admin update is reflected on the public list right away', async () => {
    const pool = createStatefulFaqPool();
    const { app } = buildTestApp({ pool });

    const created = await request(app)
      .post('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: '舊問題', info: '舊解答', no: 5 });
    const id = created.body.data.id;

    await request(app)
      .put(`/api/v2/admin/faq/${id}`)
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: '新問題', info: '新解答', no: 9 });

    const res = await request(app).get('/api/v2/faq');

    expect(res.body).toEqual([{ id, name: '新問題', info: '新解答', no: 9 }]);
  });

  it('an admin delete removes the row from the public list right away (hard delete)', async () => {
    const pool = createStatefulFaqPool();
    const { app } = buildTestApp({ pool });

    const created = await request(app)
      .post('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ name: '待刪除', info: '待刪除', no: 5 });
    const id = created.body.data.id;

    await request(app)
      .delete('/api/v2/admin/faq')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send({ ids: [id] });

    const res = await request(app).get('/api/v2/faq');

    expect(res.body).toEqual([]);
  });
});
