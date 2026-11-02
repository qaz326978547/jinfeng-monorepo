import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app';

const FRONTEND = 'https://jinfeng-rehearsal.example';

describe('CORS', () => {
  const { app } = buildTestApp({
    env: { CORS_ALLOWED_ORIGINS: `${FRONTEND},http://localhost:3000` },
  });

  it('allows the contact preflight with Idempotency-Key from an allowed origin', async () => {
    const res = await request(app)
      .options('/api/v2/contact')
      .set('Origin', FRONTEND)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toBe('content-type,idempotency-key');
  });

  it('allows a same-origin POST, which browsers still send with an Origin header', async () => {
    const res = await request(app).post('/api/v2/consultations').set('Origin', FRONTEND).send({});

    expect(res.status).toBe(400); // validation, not a CORS rejection
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND);
  });

  it('does not grant an origin outside the allowlist', async () => {
    const res = await request(app)
      .options('/api/v2/contact')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
