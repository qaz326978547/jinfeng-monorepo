import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';

function carouselRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: '講座宣傳圖',
    imageUrl: 'https://bucket.s3.ap-northeast-1.amazonaws.com/carousel/a.webp',
    linkType: 'internal',
    linkUrl: '/about',
    ...overrides,
  };
}

describe('GET /api/v2/carousels', () => {
  it('requires no auth and returns 200 with a bare array', async () => {
    const rows = [carouselRow()];
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([rows, []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/carousels');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
  });

  it('only selects active rows, ordered by sort_order then id', async () => {
    const queryFn = vi.fn().mockResolvedValue([[], []]);
    const pool = createMockPool({ query: queryFn });
    const { app } = buildTestApp({ pool });

    await request(app).get('/api/v2/carousels');

    const sql = queryFn.mock.calls[0]?.[0] as string;
    expect(sql).toContain('WHERE is_active = 1');
    expect(sql).toContain('ORDER BY sort_order ASC, id ASC');
    expect(sql).not.toContain('image_key');
  });

  it('returns [] when there are no active carousels', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/carousels');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
