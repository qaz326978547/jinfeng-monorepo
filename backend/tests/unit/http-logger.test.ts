import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createHttpLogger } from '../../src/infrastructure/logger/http-logger';

describe('http logger', () => {
  it('redacts Authorization and Cookie but keeps the client-IP headers', async () => {
    const lines: string[] = [];
    const logger = pino({ level: 'info' }, { write: (line: string) => lines.push(line) });
    const app = express();
    app.use(createHttpLogger(logger));
    app.get('/', (_req, res) => {
      res.sendStatus(204);
    });

    await request(app)
      .get('/')
      .set('Authorization', 'Bearer secret-admin-jwt')
      .set('Cookie', 'session=secret-cookie')
      .set('do-connecting-ip', '203.0.113.7');

    const output = lines.join('');
    expect(output).not.toContain('secret-admin-jwt');
    expect(output).not.toContain('secret-cookie');
    const headers = JSON.parse(lines[0] ?? '{}').req.headers;
    expect(headers.authorization).toBe('[Redacted]');
    expect(headers['do-connecting-ip']).toBe('203.0.113.7');
  });
});
