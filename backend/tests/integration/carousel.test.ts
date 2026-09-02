import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';

function carouselRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: '講座宣傳圖',
    desktopImageUrl: 'https://cdn.laborservice5690.com/carousel/desktop/a.webp',
    mobileImageUrl: 'https://cdn.laborservice5690.com/carousel/mobile/a.webp',
    linkType: 'internal',
    linkUrl: '/about',
    sortOrder: 1,
    isActive: 1,
    ...overrides,
  };
}

describe('GET /api/v2/carousels', () => {
  it('requires no auth and returns 200 with a bare array of {..., isActive: true} (never *ImageKey)', async () => {
    const rows = [carouselRow()];
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([rows, []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/carousels');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ ...rows[0], isActive: true }]);
    expect(res.body[0]).not.toHaveProperty('desktopImageKey');
    expect(res.body[0]).not.toHaveProperty('mobileImageKey');
  });

  it('only selects active rows, ordered by sort_order then id, and never selects the image keys', async () => {
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

  it('excludes inactive rows (filtering happens in SQL, but this pins the response contract)', async () => {
    const rows = [carouselRow({ id: 1, isActive: 1 })];
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([rows, []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/carousels');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].isActive).toBe(true);
  });

  it('preserves sort_order/id ASC ordering as returned by the query', async () => {
    const rows = [
      carouselRow({ id: 2, title: 'B', sortOrder: 1 }),
      carouselRow({ id: 1, title: 'A', sortOrder: 2 }),
    ];
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([rows, []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/carousels');

    expect(res.body.map((row: { title: string }) => row.title)).toEqual(['B', 'A']);
  });
});
