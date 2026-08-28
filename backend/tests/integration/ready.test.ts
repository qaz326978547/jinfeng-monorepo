import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';

describe('GET /ready', () => {
  it('returns 200 when the database is reachable', async () => {
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[{ '1': 1 }], []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ready' });
  });

  it('returns 503 when the database is unreachable', async () => {
    const pool = createMockPool({
      query: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
    });
    const { app } = buildTestApp({ pool });

    const res = await request(app).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
  });
});
