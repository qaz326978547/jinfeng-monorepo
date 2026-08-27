import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool, createMockMailTransport } from '../helpers/build-test-app';

type QueryCall = [string, unknown[]?];

function queryCallsMatching(queryFn: ReturnType<typeof vi.fn>, prefix: string): QueryCall[] {
  const calls = queryFn.mock.calls as QueryCall[];
  return calls.filter(([sql]) => sql.startsWith(prefix));
}

function findQueryCall(queryFn: ReturnType<typeof vi.fn>, prefix: string): QueryCall {
  const call = queryCallsMatching(queryFn, prefix)[0];
  if (!call) {
    throw new Error(`expected a query call starting with "${prefix}"`);
  }
  return call;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    class: '勞資爭議講座',
    quest: '想了解資遣費計算',
    company: '測試股份有限公司',
    tel: '0212345678',
    num: '2',
    contactList: [{ name: '王小明', email: 'test@example.com', job: '經理', cel: '0912345678' }],
    ...overrides,
  };
}

interface MockConnection {
  query: ReturnType<typeof vi.fn>;
  beginTransaction: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  rollback: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

function contactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    class: '勞資爭議講座',
    quest: '想了解資遣費計算',
    company: '測試股份有限公司',
    tel: '0212345678',
    num: '2',
    last5: null,
    ticket: null,
    ticket_name: null,
    ticket_no: null,
    ticket_address: null,
    from: null,
    suggest_name: null,
    del: 0,
    no: 0,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
    ...overrides,
  };
}

/** Happy-path connection: INSERT contact -> INSERT contact_list* -> SELECT the row back. */
function buildHappyConnection(row = contactRow()): MockConnection {
  const query = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('INSERT INTO contact ')) {
      return Promise.resolve([{ insertId: row.id, affectedRows: 1 }, []]);
    }
    if (sql.startsWith('INSERT INTO contact_list')) {
      return Promise.resolve([{ insertId: 1, affectedRows: 1 }, []]);
    }
    if (sql.startsWith('SELECT * FROM contact WHERE id')) {
      return Promise.resolve([[row], []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return {
    query,
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
}

function buildFailingConnection(failOn: 'contact' | 'contact_list'): MockConnection {
  const query = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('INSERT INTO contact ')) {
      if (failOn === 'contact') {
        return Promise.reject(new Error('DB connection lost'));
      }
      return Promise.resolve([{ insertId: 1, affectedRows: 1 }, []]);
    }
    if (sql.startsWith('INSERT INTO contact_list')) {
      if (failOn === 'contact_list') {
        return Promise.reject(new Error('DB connection lost'));
      }
      return Promise.resolve([{ insertId: 1, affectedRows: 1 }, []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return {
    query,
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
}

function poolWithConnection(connection: MockConnection) {
  return createMockPool({ getConnection: vi.fn().mockResolvedValue(connection) });
}

describe('POST /api/v2/contact', () => {
  describe('valid submissions', () => {
    it('returns 201 for a single contactList item and writes contact + one contact_list row', async () => {
      const connection = buildHappyConnection();
      const { app } = buildTestApp({ pool: poolWithConnection(connection) });

      const res = await request(app).post('/api/v2/contact').send(validPayload());

      expect(res.status).toBe(201);
      expect(queryCallsMatching(connection.query, 'INSERT INTO contact_list')).toHaveLength(1);
      expect(connection.commit).toHaveBeenCalledTimes(1);
      expect(connection.rollback).not.toHaveBeenCalled();
    });

    it('returns 201 for multiple contactList items and writes one contact_list row per item', async () => {
      const connection = buildHappyConnection();
      const { app } = buildTestApp({ pool: poolWithConnection(connection) });

      const res = await request(app)
        .post('/api/v2/contact')
        .send(
          validPayload({
            contactList: [
              { name: '王小明', email: 'a@example.com', job: '經理', cel: '0912345678' },
              { name: '陳小華', email: 'b@example.com', cel: '0922345678' },
            ],
          }),
        );

      expect(res.status).toBe(201);
      expect(queryCallsMatching(connection.query, 'INSERT INTO contact_list')).toHaveLength(2);
    });

    it('normalizes an empty-string ticket (frontend default when no radio is picked) to null instead of rejecting it', async () => {
      const connection = buildHappyConnection();
      const { app } = buildTestApp({ pool: poolWithConnection(connection) });

      const res = await request(app).post('/api/v2/contact').send(validPayload({ ticket: '' }));

      expect(res.status).toBe(201);
      const contactInsert = findQueryCall(connection.query, 'INSERT INTO contact ');
      // Params: class, quest, company, tel, num, last5, ticket, ...
      expect(contactInsert[1]?.[6]).toBeNull();
    });

    it('sets created_at/updated_at to NOW() on both contact and contact_list inserts — regression test for admin list page-1 bug (NULL sorts last under ORDER BY created_at DESC)', async () => {
      const connection = buildHappyConnection();
      const { app } = buildTestApp({ pool: poolWithConnection(connection) });

      await request(app).post('/api/v2/contact').send(validPayload());

      const contactInsert = findQueryCall(connection.query, 'INSERT INTO contact ');
      expect(contactInsert[0]).toBe(
        'INSERT INTO contact (class, quest, company, tel, num, last5, ticket, ticket_name, ticket_no, ticket_address, `from`, suggest_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      );

      const contactListInsert = findQueryCall(connection.query, 'INSERT INTO contact_list');
      expect(contactListInsert[0]).toBe(
        'INSERT INTO contact_list (name, email, job, cel, cid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      );
    });
  });

  describe('validation failures (400, {status:"error", message}) — no DB write attempted', () => {
    it('rejects a missing required field (class) with the FormRequest-compatible shape', async () => {
      const payload = validPayload();
      delete (payload as Record<string, unknown>).class;
      const { app } = buildTestApp();

      const res = await request(app).post('/api/v2/contact').send(payload);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ status: 'error', message: 'class 為必填欄位' });
    });

    it('reports only the first validation error when multiple fields are invalid', async () => {
      const payload = validPayload();
      delete (payload as Record<string, unknown>).class;
      delete (payload as Record<string, unknown>).quest;
      const { app } = buildTestApp();

      const res = await request(app).post('/api/v2/contact').send(payload);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ status: 'error', message: 'class 為必填欄位' });
      expect(res.body.errors).toBeUndefined();
    });

    it('rejects an invalid contactList email', async () => {
      const { app } = buildTestApp();

      const res = await request(app)
        .post('/api/v2/contact')
        .send(
          validPayload({
            contactList: [{ name: '王小明', email: 'not-an-email', cel: '0912345678' }],
          }),
        );

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('email');
    });

    it('rejects tel longer than 10 characters', async () => {
      const { app } = buildTestApp();

      const res = await request(app).post('/api/v2/contact').send(validPayload({ tel: '12345678901' }));

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('tel');
    });

    it('rejects contactList cel longer than 10 characters', async () => {
      const { app } = buildTestApp();

      const res = await request(app)
        .post('/api/v2/contact')
        .send(
          validPayload({
            contactList: [{ name: '王小明', email: 'test@example.com', cel: '12345678901' }],
          }),
        );

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cel');
    });
  });

  describe('transaction atomicity (intentional reliability improvement over legacy no-transaction behavior)', () => {
    it('rolls back and returns 500 when the contact insert fails', async () => {
      const connection = buildFailingConnection('contact');
      const { app } = buildTestApp({ pool: poolWithConnection(connection) });

      const res = await request(app).post('/api/v2/contact').send(validPayload());

      expect(res.status).toBe(500);
      expect(connection.rollback).toHaveBeenCalledTimes(1);
      expect(connection.commit).not.toHaveBeenCalled();
    });

    it('rolls back and returns 500 when a contactList insert fails, leaving no partial contact row', async () => {
      const connection = buildFailingConnection('contact_list');
      const { app } = buildTestApp({ pool: poolWithConnection(connection) });

      const res = await request(app).post('/api/v2/contact').send(validPayload());

      expect(res.status).toBe(500);
      expect(connection.rollback).toHaveBeenCalledTimes(1);
      expect(connection.commit).not.toHaveBeenCalled();
    });
  });

  describe('mail (mock transport only — never a real SMTP connection)', () => {
    it('sends the notification email when mail is configured and returns 201', async () => {
      const connection = buildHappyConnection();
      const mailTransport = createMockMailTransport();
      const { app } = buildTestApp({
        pool: poolWithConnection(connection),
        env: { MAIL_HOST: 'smtp.test.local', RECIPIENT_EMAIL: 'ops@example.com' },
        mailTransport,
      });

      const res = await request(app).post('/api/v2/contact').send(validPayload());

      expect(res.status).toBe(201);
      expect(mailTransport.sendMail).toHaveBeenCalledTimes(1);
      const sendMailMock = mailTransport.sendMail as ReturnType<typeof vi.fn>;
      const sentMessage = sendMailMock.mock.calls[0]?.[0];
      expect(sentMessage.to).toBe('ops@example.com');
      expect(sentMessage.text).toContain('測試股份有限公司');
    });

    it('keeps the saved registration and still returns 201 when the mail send fails', async () => {
      const connection = buildHappyConnection();
      const mailTransport = createMockMailTransport({
        sendMail: vi.fn().mockRejectedValue(new Error('SMTP connection refused')),
      });
      const { app } = buildTestApp({
        pool: poolWithConnection(connection),
        env: { MAIL_HOST: 'smtp.test.local', RECIPIENT_EMAIL: 'ops@example.com' },
        mailTransport,
      });

      const res = await request(app).post('/api/v2/contact').send(validPayload());

      expect(res.status).toBe(201);
      expect(connection.commit).toHaveBeenCalledTimes(1);
      expect(mailTransport.sendMail).toHaveBeenCalledTimes(1);
    });

    it('skips sending (no throw) when mail is not configured at all', async () => {
      const connection = buildHappyConnection();
      const { app } = buildTestApp({ pool: poolWithConnection(connection) });

      const res = await request(app).post('/api/v2/contact').send(validPayload());

      expect(res.status).toBe(201);
    });
  });

  describe('response contract', () => {
    it('returns 201 with {message, data} where data is the contact row only (no contactList)', async () => {
      const row = contactRow({ id: 42 });
      const connection = buildHappyConnection(row);
      const { app } = buildTestApp({ pool: poolWithConnection(connection) });

      const res = await request(app).post('/api/v2/contact').send(validPayload());

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('新增成功');
      expect(res.body.data).toEqual(row);
      expect(res.body.data.contactList).toBeUndefined();
    });
  });
});
