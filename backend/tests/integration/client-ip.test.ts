import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createClientIp } from '../../src/middleware/client-ip';
import { createInMemoryRateLimiter } from '../../src/middleware/rate-limit';
import { buildTestApp } from '../helpers/build-test-app';

/** Same trust-proxy setting as app.ts, a limiter of 2, and an echo of the key. */
function buildLimitedApp(header: string) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(createClientIp(header));
  app.post('/', createInMemoryRateLimiter({ windowMs: 60_000, max: 2 }), (req, res) => {
    res.json({ clientIp: req.clientIp });
  });
  return app;
}

describe('client IP for rate limiting', () => {
  describe('CLIENT_IP_HEADER unset (Zeabur)', () => {
    it('uses req.ip and ignores do-connecting-ip', async () => {
      const app = buildLimitedApp('');

      const res = await request(app)
        .post('/')
        .set('X-Forwarded-For', '198.51.100.9')
        .set('do-connecting-ip', '203.0.113.7');

      expect(res.body.clientIp).toBe('198.51.100.9');
    });

    it('cannot dodge the limit by rotating do-connecting-ip', async () => {
      const app = buildLimitedApp('');
      const send = (ip: string) => request(app).post('/').set('do-connecting-ip', ip);

      expect((await send('203.0.113.1')).status).toBe(200);
      expect((await send('203.0.113.2')).status).toBe(200);
      expect((await send('203.0.113.3')).status).toBe(429);
    });
  });

  describe('CLIENT_IP_HEADER=do-connecting-ip (DigitalOcean)', () => {
    // On App Platform every request arrives with the same ingress address in
    // X-Forwarded-For; only do-connecting-ip tells visitors apart.
    const INGRESS = '10.244.0.5';
    const send = (app: express.Express, clientIp?: string) => {
      const req = request(app).post('/').set('X-Forwarded-For', INGRESS);
      return clientIp === undefined ? req : req.set('do-connecting-ip', clientIp);
    };

    it('gives each visitor their own bucket behind a shared ingress IP', async () => {
      const app = buildLimitedApp('do-connecting-ip');

      expect((await send(app, '203.0.113.1')).status).toBe(200);
      expect((await send(app, '203.0.113.1')).status).toBe(200);
      expect((await send(app, '203.0.113.1')).status).toBe(429);

      const other = await send(app, '203.0.113.2');
      expect(other.status).toBe(200);
      expect(other.body.clientIp).toBe('203.0.113.2');
    });

    it('accepts IPv6', async () => {
      const res = await send(buildLimitedApp('do-connecting-ip'), '2001:db8::1');
      expect(res.body.clientIp).toBe('2001:db8::1');
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['a comma-separated list', '203.0.113.1, 203.0.113.2'],
      ['not an IP', 'evil'],
    ])(
      'falls back to req.ip (shared ingress bucket) when the header is %s',
      async (_label, value) => {
        const res = await send(buildLimitedApp('do-connecting-ip'), value);
        expect(res.body.clientIp).toBe(INGRESS);
      },
    );

    it('rate-limits malformed values together instead of one bucket each', async () => {
      const app = buildLimitedApp('do-connecting-ip');

      expect((await send(app, 'junk-1')).status).toBe(200);
      expect((await send(app, 'junk-2')).status).toBe(200);
      expect((await send(app, 'junk-3')).status).toBe(429);
    });
  });

  it('is wired into createApp from env.CLIENT_IP_HEADER', async () => {
    const { app } = buildTestApp({ env: { CLIENT_IP_HEADER: 'do-connecting-ip' } });
    const send = (ip: string) =>
      request(app).post('/api/v2/consultations').set('do-connecting-ip', ip).send({});

    // Consultations: 5 / 10 min. The limiter runs before validation, so empty
    // bodies (422, no DB access) still count.
    for (let i = 0; i < 5; i += 1) {
      expect((await send('203.0.113.1')).status).not.toBe(429);
    }
    expect((await send('203.0.113.1')).status).toBe(429);
    expect((await send('203.0.113.2')).status).not.toBe(429);
  });
});
