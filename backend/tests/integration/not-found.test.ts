import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/build-test-app';

describe('unknown routes', () => {
  it('returns 404 with a NOT_FOUND error body', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/this-route-does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
    expect(res.body.requestId).toBeTruthy();
  });
});
