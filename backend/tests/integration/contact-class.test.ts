import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';

function contactClassRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: '勞資爭議',
    no: 10,
    del: 0,
    created_at: '2024-06-25T00:00:00.000Z',
    updated_at: '2024-06-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('GET /api/v2/contact-class', () => {
  it('returns 200 with a JSON array', async () => {
    const rows = [contactClassRow()];
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([rows, []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-class');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
  });

  it('issues SELECT * FROM contact_class WHERE del = 0 ORDER BY no DESC', async () => {
    const queryFn = vi.fn().mockResolvedValue([[], []]);
    const pool = createMockPool({ query: queryFn });
    const { app } = buildTestApp({ pool });

    await request(app).get('/api/v2/contact-class');

    expect(queryFn).toHaveBeenCalledWith(
      'SELECT * FROM contact_class WHERE del = 0 ORDER BY no DESC',
    );
  });

  it('returns [] when there are no active rows', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-class');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('is not paginated — always a plain array, no envelope fields', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[contactClassRow()], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-class');

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.data).toBeUndefined();
  });

  it('does not require authentication', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/api/v2/contact-class');

    expect(res.status).not.toBe(401);
  });
});
