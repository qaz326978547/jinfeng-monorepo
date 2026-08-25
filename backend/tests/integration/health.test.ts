import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/build-test-app';

describe('GET /health', () => {
  it('returns 200 with liveness status', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(typeof res.body.uptime).toBe('number');
  });
});
