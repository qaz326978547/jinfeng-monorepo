import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';

type QueryCall = [string, unknown[]?];

function findQueryCall(queryFn: ReturnType<typeof vi.fn>, prefix: string): QueryCall {
  const calls = queryFn.mock.calls as QueryCall[];
  const call = calls.find(([sql]) => sql.startsWith(prefix));
  if (!call) {
    throw new Error(`expected a query call starting with "${prefix}"`);
  }
  return call;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: '王小明',
    phone: '0912345678',
    companyName: 'XX有限公司',
    taxId: '12345678',
    lineId: 'abc123',
    callbackTimes: ['afternoon', 'evening'],
    message: '想了解勞動契約相關問題',
    ...overrides,
  };
}

function consultationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: '王小明',
    phone: '0912345678',
    companyName: 'XX有限公司',
    taxId: '12345678',
    lineId: 'abc123',
    callbackTimes: JSON.stringify(['afternoon', 'evening']),
    message: '想了解勞動契約相關問題',
    status: 'pending',
    createdAt: '2026-09-11T00:00:00.000Z',
    updatedAt: '2026-09-11T00:00:00.000Z',
    ...overrides,
  };
}

/** Happy-path pool: INSERT consultations -> SELECT the row back by id. */
function buildHappyPool(row = consultationRow()) {
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('INSERT INTO consultations')) {
      return Promise.resolve([{ insertId: row.id, affectedRows: 1 }, []]);
    }
    if (sql.startsWith('SELECT') && sql.includes('FROM consultations WHERE id = ?')) {
      return Promise.resolve([[row], []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return { pool: createMockPool({ query: queryFn }), queryFn };
}

describe('POST /api/v2/consultations', () => {
  it('does not require authentication', async () => {
    const { pool } = buildHappyPool();
    const { app } = buildTestApp({ pool });

    const res = await request(app).post('/api/v2/consultations').send(validPayload());

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('returns 201 {message, data} for a fully valid payload', async () => {
    const row = consultationRow();
    const { pool } = buildHappyPool(row);
    const { app } = buildTestApp({ pool });

    const res = await request(app).post('/api/v2/consultations').send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('新增成功');
    expect(res.body.data).toEqual({ ...row, callbackTimes: ['afternoon', 'evening'] });
  });

  it('returns 201 when only required fields are provided (optionals omitted)', async () => {
    const row = consultationRow({
      companyName: null,
      taxId: null,
      lineId: null,
      message: null,
      callbackTimes: JSON.stringify(['morning']),
    });
    const { pool } = buildHappyPool(row);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .post('/api/v2/consultations')
      .send({ name: '陳小華', phone: '0922345678', callbackTimes: ['morning'] });

    expect(res.status).toBe(201);
  });

  it('rejects missing name', async () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).name;
    const { app } = buildTestApp();

    const res = await request(app).post('/api/v2/consultations').send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'name 為必填欄位' });
  });

  it('rejects missing phone', async () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).phone;
    const { app } = buildTestApp();

    const res = await request(app).post('/api/v2/consultations').send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'phone 為必填欄位' });
  });

  it('rejects an empty-string name (trimmed)', async () => {
    const { app } = buildTestApp();

    const res = await request(app).post('/api/v2/consultations').send(validPayload({ name: '   ' }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('name 為必填欄位');
  });

  it('rejects name longer than 100 characters', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/consultations')
      .send(validPayload({ name: '王'.repeat(101) }));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('name');
  });

  it('rejects phone longer than 20 characters', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/consultations')
      .send(validPayload({ phone: '0'.repeat(21) }));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('phone');
  });

  it('rejects message longer than 1000 characters', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/consultations')
      .send(validPayload({ message: '問'.repeat(1001) }));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('message');
  });

  it('rejects missing callbackTimes', async () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).callbackTimes;
    const { app } = buildTestApp();

    const res = await request(app).post('/api/v2/consultations').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('callbackTimes');
  });

  it('rejects an empty callbackTimes array', async () => {
    const { app } = buildTestApp();

    const res = await request(app).post('/api/v2/consultations').send(validPayload({ callbackTimes: [] }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('callbackTimes 為必填欄位，至少需選擇一個時段');
  });

  it('rejects an unknown callbackTimes enum value', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/consultations')
      .send(validPayload({ callbackTimes: ['night'] }));

    expect(res.status).toBe(400);
  });

  it('rejects duplicate callbackTimes values', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/consultations')
      .send(validPayload({ callbackTimes: ['morning', 'morning'] }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('callbackTimes 不可包含重複的時段');
  });

  it('rejects "anytime" combined with another value', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/consultations')
      .send(validPayload({ callbackTimes: ['anytime', 'afternoon'] }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('選擇「anytime」時不可再選擇其他時段');
  });

  it('accepts "anytime" alone', async () => {
    const row = consultationRow({ callbackTimes: JSON.stringify(['anytime']) });
    const { pool } = buildHappyPool(row);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .post('/api/v2/consultations')
      .send(validPayload({ callbackTimes: ['anytime'] }));

    expect(res.status).toBe(201);
  });

  it('ignores a client-sent status field and always writes with the DB default (never included in the INSERT params)', async () => {
    const { pool, queryFn } = buildHappyPool();
    const { app } = buildTestApp({ pool });

    await request(app).post('/api/v2/consultations').send(validPayload({ status: 'completed' }));

    const insertCall = findQueryCall(queryFn, 'INSERT INTO consultations');
    expect(insertCall[0]).toBe(
      'INSERT INTO consultations\n         (name, phone, company_name, tax_id, line_id, callback_times, message)\n       VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    // params: name, phone, companyName, taxId, lineId, callbackTimes(JSON string), message
    expect(insertCall[1]).toEqual([
      '王小明',
      '0912345678',
      'XX有限公司',
      '12345678',
      'abc123',
      JSON.stringify(['afternoon', 'evening']),
      '想了解勞動契約相關問題',
    ]);
  });
});
