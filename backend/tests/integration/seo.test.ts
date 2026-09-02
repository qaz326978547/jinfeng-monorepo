import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';

function seoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    class_id: null,
    relate_id: 0,
    tag: 'home',
    name: '首頁',
    title: '金豐',
    description: '金豐企業管理顧問股份有限公司',
    url: '/',
    type: 'website',
    keyword: '企業管理顧問,金豐',
    pic: 'seo.jpg',
    pic_alt: '金豐',
    del: 0,
    created_at: '2024-06-25T00:00:00.000Z',
    updated_at: '2024-06-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('GET /api/v2/seo', () => {
  it('returns 200 with a JSON array mapped straight from the DB rows', async () => {
    const rows = [seoRow()];
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([rows, []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/seo');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
  });

  it('includes rows with del=1 — legacy parity, del is intentionally not filtered', async () => {
    const rows = [seoRow(), seoRow({ id: 2, del: 1 })];
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([rows, []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/seo');

    expect(res.body).toHaveLength(2);
    expect(res.body[1].del).toBe(1);
  });

  it('issues an unfiltered, unordered SELECT * FROM seo query', async () => {
    const queryFn = vi.fn().mockResolvedValue([[], []]);
    const pool = createMockPool({ query: queryFn });
    const { app } = buildTestApp({ pool });

    await request(app).get('/api/v2/seo');

    expect(queryFn).toHaveBeenCalledWith('SELECT * FROM seo');
  });

  it('returns [] when the table is empty', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/seo');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('does not require authentication', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/seo');

    expect(res.status).not.toBe(401);
  });
});
