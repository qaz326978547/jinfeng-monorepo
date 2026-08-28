import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Mock } from 'vitest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';

type QueryCall = [string, unknown[]?];

function findPageCall(queryFn: Mock): QueryCall {
  const calls = queryFn.mock.calls as QueryCall[];
  const call = calls.find(([sql]) => !sql.includes('COUNT(*)'));
  if (!call) {
    throw new Error('expected a non-COUNT(*) query call');
  }
  return call;
}

function questRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: '想了解資遣費計算',
    no: 10,
    del: 0,
    created_at: '2024-06-25T00:00:00.000Z',
    updated_at: '2024-06-25T00:00:00.000Z',
    ...overrides,
  };
}

/** COUNT(*) and the paged SELECT are two separate pool.query calls; branch on the SQL text. */
function mockPagedPool(total: number, pageRows: unknown[]) {
  const queryFn: Mock = vi.fn().mockImplementation((sql: string) => {
    if (sql.includes('COUNT(*)')) {
      return Promise.resolve([[{ total }], []]);
    }
    return Promise.resolve([pageRows, []]);
  });
  return { pool: createMockPool({ query: queryFn }), queryFn };
}

describe('GET /api/v2/contact-quest', () => {
  it('defaults to page 1 when ?page is omitted', async () => {
    const { pool } = mockPagedPool(7, [questRow()]);
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-quest');

    expect(res.status).toBe(200);
    expect(res.body.current_page).toBe(1);
  });

  it('honors ?page=2 and queries with the correct LIMIT/OFFSET', async () => {
    const { pool, queryFn } = mockPagedPool(15, [questRow({ id: 11 })]);
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-quest?page=2');

    expect(res.status).toBe(200);
    expect(res.body.current_page).toBe(2);
    const pageCall = findPageCall(queryFn);
    expect(pageCall[1]).toEqual([10, 10]);
  });

  it('returns per_page: 10 and the page of data as-is', async () => {
    const rows = [questRow()];
    const { pool } = mockPagedPool(1, rows);
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-quest');

    expect(res.body.per_page).toBe(10);
    expect(res.body.data).toEqual(rows);
  });

  it('computes total and last_page from the row count', async () => {
    const { pool } = mockPagedPool(25, [questRow()]);
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-quest');

    expect(res.body.total).toBe(25);
    expect(res.body.last_page).toBe(3);
  });

  it('queries with WHERE del = 0 ORDER BY no DESC', async () => {
    const { pool, queryFn } = mockPagedPool(1, [questRow()]);
    const { app } = buildTestApp({ pool });

    await request(app).get('/api/v2/contact-quest');

    const pageCall = findPageCall(queryFn);
    expect(pageCall[0]).toContain('del = 0');
    expect(pageCall[0]).toContain('ORDER BY no DESC');
  });

  it('returns a Laravel-compatible empty envelope when there is no data', async () => {
    const { pool } = mockPagedPool(0, []);
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-quest');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      current_page: 1,
      data: [],
      last_page: 1,
      per_page: 10,
      total: 0,
      from: null,
      to: null,
    });
  });

  it('falls back to page 1 for a non-numeric ?page value (Laravel default, not a validation error)', async () => {
    const { pool } = mockPagedPool(1, [questRow()]);
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-quest?page=abc');

    expect(res.status).toBe(200);
    expect(res.body.current_page).toBe(1);
  });

  it('includes the full Laravel paginator envelope field set', async () => {
    const { pool } = mockPagedPool(1, [questRow()]);
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-quest');

    expect(Object.keys(res.body).sort()).toEqual(
      [
        'current_page',
        'data',
        'first_page_url',
        'from',
        'last_page',
        'last_page_url',
        'links',
        'next_page_url',
        'path',
        'per_page',
        'prev_page_url',
        'to',
        'total',
      ].sort(),
    );
  });

  it('does not require authentication', async () => {
    const { pool } = mockPagedPool(0, []);
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-quest');

    expect(res.status).not.toBe(401);
  });
});
