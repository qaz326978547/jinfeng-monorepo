import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';

function newsRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: '台南 廟祝被炒魷魚 討加班費',
    sourceName: '中國時報',
    sourceUrl: 'https://www.chinatimes.com/example',
    publishedAt: '2026-08-29',
    sortOrder: 1,
    ...overrides,
  };
}

/**
 * Mirrors labor-news.repository.ts: countActive() issues a COUNT query first, then
 * findActivePage() issues the SELECT ... LIMIT/OFFSET — distinguished here by SQL text
 * (SELECT COUNT vs SELECT id, ...) exactly like mockFaqCreatePool in admin-faq.test.ts.
 */
function mockLaborNewsListPool(options: { total: number; rows: unknown[] }) {
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('SELECT COUNT(*)')) {
      return Promise.resolve([[{ total: options.total }], []]);
    }
    if (sql.includes('FROM labor_news') && !sql.includes('COUNT')) {
      return Promise.resolve([options.rows, []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return { pool: createMockPool({ query: queryFn }), queryFn };
}

describe('GET /api/v2/labor-news', () => {
  it('returns 200 with a Laravel-style pagination envelope', async () => {
    const rows = [newsRow()];
    const { pool } = mockLaborNewsListPool({ total: 1, rows });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/labor-news?page=1&pageSize=10');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(rows);
    expect(res.body.current_page).toBe(1);
    expect(res.body.per_page).toBe(10);
    expect(res.body.total).toBe(1);
  });

  it('only queries is_active = 1 (never returns inactive rows)', async () => {
    const { pool, queryFn } = mockLaborNewsListPool({ total: 0, rows: [] });
    const { app } = buildTestApp({ pool });

    await request(app).get('/api/v2/labor-news');

    const countCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      sql.startsWith('SELECT COUNT(*)'),
    );
    expect(countCall?.[0]).toContain('is_active = 1');
  });

  it('orders by sort_order ASC, published_at DESC, id DESC', async () => {
    const { pool, queryFn } = mockLaborNewsListPool({ total: 1, rows: [newsRow()] });
    const { app } = buildTestApp({ pool });

    await request(app).get('/api/v2/labor-news');

    const selectCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      (sql.includes('FROM labor_news') && !sql.includes('COUNT')),
    );
    expect(selectCall?.[0]).toContain('ORDER BY sort_order ASC, published_at DESC, id DESC');
  });

  it('same sort_order: the DB is trusted to break ties by publishedAt DESC — response preserves that order', async () => {
    const older = newsRow({ id: 10, sortOrder: 1, publishedAt: '2026-08-01' });
    const newer = newsRow({ id: 11, sortOrder: 1, publishedAt: '2026-08-10' });
    // Rows are returned pre-sorted by the (mocked) DB, matching the ORDER BY clause under test above.
    const { pool } = mockLaborNewsListPool({ total: 2, rows: [newer, older] });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/labor-news');

    expect(res.body.data).toEqual([newer, older]);
  });

  it('same sort_order and publishedAt: preserves DB-provided id DESC tie-break order', async () => {
    const lower = newsRow({ id: 5, sortOrder: 2, publishedAt: '2026-08-10' });
    const higher = newsRow({ id: 7, sortOrder: 2, publishedAt: '2026-08-10' });
    const { pool } = mockLaborNewsListPool({ total: 2, rows: [higher, lower] });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/labor-news');

    expect(res.body.data).toEqual([higher, lower]);
  });

  it('computes LIMIT/OFFSET from page and pageSize', async () => {
    const { pool, queryFn } = mockLaborNewsListPool({ total: 25, rows: [] });
    const { app } = buildTestApp({ pool });

    await request(app).get('/api/v2/labor-news?page=3&pageSize=10');

    const selectCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      (sql.includes('FROM labor_news') && !sql.includes('COUNT')),
    );
    expect(selectCall?.[1]).toEqual([10, 20]);
  });

  it('the homepage request shape (pageSize=5) returns at most 5 rows and per_page=5', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => newsRow({ id: i + 1, sortOrder: i + 1 }));
    const { pool, queryFn } = mockLaborNewsListPool({ total: 20, rows });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/labor-news?page=1&pageSize=5');

    expect(res.body.per_page).toBe(5);
    expect(res.body.data).toHaveLength(5);
    const selectCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      (sql.includes('FROM labor_news') && !sql.includes('COUNT')),
    );
    expect(selectCall?.[1]).toEqual([5, 0]);
  });

  it('keyword searches title OR source_name via parameterized LIKE', async () => {
    const { pool, queryFn } = mockLaborNewsListPool({ total: 0, rows: [] });
    const { app } = buildTestApp({ pool });

    await request(app).get('/api/v2/labor-news?keyword=加班');

    const countCall = (queryFn.mock.calls as [string, unknown[]?][]).find(([sql]) =>
      sql.startsWith('SELECT COUNT(*)'),
    );
    expect(countCall?.[0]).toContain('title LIKE ? OR source_name LIKE ?');
    expect(countCall?.[1]).toEqual(['%加班%', '%加班%']);
  });

  it('pagination total reflects the searched (filtered) count, not the full table', async () => {
    const { pool } = mockLaborNewsListPool({ total: 2, rows: [newsRow(), newsRow({ id: 2 })] });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/labor-news?keyword=加班');

    expect(res.body.total).toBe(2);
    expect(res.body.last_page).toBe(1);
  });

  it('returns an empty data array and skips the SELECT when total is 0', async () => {
    const { pool, queryFn } = mockLaborNewsListPool({ total: 0, rows: [] });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/labor-news');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(queryFn.mock.calls.some(([sql]) => (sql as string).includes('FROM labor_news') && !(sql as string).includes('COUNT'))).toBe(
      false,
    );
  });
});
