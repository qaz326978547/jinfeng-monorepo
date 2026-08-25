import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';

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
