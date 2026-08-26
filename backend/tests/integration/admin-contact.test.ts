import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool } from '../helpers/build-test-app';
import { adminUserToken, normalUserToken } from '../helpers/auth-tokens';

type QueryCall = [string, unknown[]?];

function findQueryCall(queryFn: ReturnType<typeof vi.fn>, predicate: (sql: string) => boolean): QueryCall {
  const calls = queryFn.mock.calls as QueryCall[];
  const call = calls.find(([sql]) => predicate(sql));
  if (!call) {
    throw new Error('expected a matching query call');
  }
  return call;
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

function contactListRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: '王小明',
    cel: '0912345678',
    job: '經理',
    email: 'test@example.com',
    no: 0,
    cid: 1,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
    ...overrides,
  };
}

function mockPagedContactPool(total: number, pageRows: unknown[]) {
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    if (sql.includes('COUNT(*)')) {
      return Promise.resolve([[{ total }], []]);
    }
    return Promise.resolve([pageRows, []]);
  });
  return { pool: createMockPool({ query: queryFn }), queryFn };
}

describe('Admin contact endpoints — authorization', () => {
  it.each([
    ['GET', '/api/v2/admin/contact'],
    ['GET', '/api/v2/admin/contact/1'],
    ['GET', '/api/v2/admin/contact/search/search-company'],
  ])('%s %s returns 401 with no Authorization header', async (method, path) => {
    const { app } = buildTestApp();

    const res = await request(app)[method.toLowerCase() as 'get'](path);

    expect(res.status).toBe(401);
  });

  it.each([
    ['GET', '/api/v2/admin/contact'],
    ['GET', '/api/v2/admin/contact/1'],
    ['GET', '/api/v2/admin/contact/search/search-company'],
  ])('%s %s returns 403 for a valid but non-admin token', async (method, path) => {
    const { app } = buildTestApp();

    const res = await request(app)
      [method.toLowerCase() as 'get'](path)
      .set('Authorization', `Bearer ${normalUserToken()}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v2/admin/contact', () => {
  it('returns 200 with a Laravel pagination envelope for an admin token', async () => {
    const { pool } = mockPagedContactPool(1, [contactRow()]);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([contactRow()]);
    expect(res.body.per_page).toBe(10);
  });

  it('defaults to page 1', async () => {
    const { pool } = mockPagedContactPool(1, [contactRow()]);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.body.current_page).toBe(1);
  });

  it('honors ?page=2 with the correct OFFSET', async () => {
    const { pool, queryFn } = mockPagedContactPool(15, [contactRow({ id: 11 })]);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact?page=2')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.body.current_page).toBe(2);
    const pageCall = findQueryCall(queryFn, (sql) => !sql.includes('COUNT(*)'));
    expect(pageCall[1]).toEqual([10, 10]);
  });

  it('orders by created_at DESC', async () => {
    const { pool, queryFn } = mockPagedContactPool(1, [contactRow()]);
    const { app } = buildTestApp({ pool });

    await request(app).get('/api/v2/admin/contact').set('Authorization', `Bearer ${adminUserToken()}`);

    const pageCall = findQueryCall(queryFn, (sql) => !sql.includes('COUNT(*)'));
    expect(pageCall[0]).toContain('ORDER BY created_at DESC');
  });

  it('reports total/last_page correctly', async () => {
    const { pool } = mockPagedContactPool(25, [contactRow()]);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.body.total).toBe(25);
    expect(res.body.last_page).toBe(3);
  });

  it('returns an empty envelope when there is no data', async () => {
    const { pool } = mockPagedContactPool(0, []);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: [], total: 0, from: null, to: null });
  });
});

describe('GET /api/v2/admin/contact/{id}', () => {
  function mockGetPool(contact: unknown, contactList: unknown[]) {
    const queryFn = vi.fn().mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT * FROM contact WHERE id')) {
        return Promise.resolve([contact ? [contact] : [], []]);
      }
      if (sql.startsWith('SELECT * FROM contact_list WHERE cid')) {
        return Promise.resolve([contactList, []]);
      }
      throw new Error(`unexpected query in test: ${sql}`);
    });
    return createMockPool({ query: queryFn });
  }

  it('returns 200 with the contact fields plus a nested contact_list array (snake_case)', async () => {
    const pool = mockGetPool(contactRow({ id: 1 }), [contactListRow()]);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact/1')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(contactRow({ id: 1 }));
    expect(res.body.contact_list).toEqual([contactListRow()]);
  });

  it('never uses the camelCase "contactList" key (contract correction — see parity doc §10/§11)', async () => {
    const pool = mockGetPool(contactRow({ id: 1 }), [contactListRow()]);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact/1')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.body.contactList).toBeUndefined();
    expect('contact_list' in res.body).toBe(true);
  });

  it('returns contact_list: [] when the contact has no associated contact_list rows', async () => {
    const pool = mockGetPool(contactRow({ id: 1 }), []);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact/1')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.contact_list).toEqual([]);
  });

  it('returns 404 {message} (no code/requestId) for a nonexistent id', async () => {
    const pool = mockGetPool(undefined, []);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact/999')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '找不到資料' });
  });
});

describe('GET /api/v2/admin/contact/search/search-company', () => {
  it('returns 200 with a matching contact via parameterized LIKE', async () => {
    const { pool, queryFn } = mockPagedContactPool(1, [contactRow({ company: 'Acme 股份有限公司' })]);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact/search/search-company?company=Acme')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const pageCall = findQueryCall(queryFn, (sql) => !sql.includes('COUNT(*)'));
    expect(pageCall[0]).toContain('WHERE company LIKE ?');
    expect(pageCall[1]).toEqual(['%Acme%', 10, 0]);
  });

  it('returns an empty paginated envelope when there is no match', async () => {
    const { pool } = mockPagedContactPool(0, []);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact/search/search-company?company=nonexistent')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('supports pagination the same way as the index endpoint', async () => {
    const { pool } = mockPagedContactPool(15, [contactRow({ id: 11 })]);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/contact/search/search-company?company=x&page=2')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.body.current_page).toBe(2);
    expect(res.body.last_page).toBe(2);
  });

  it("does not let a %/_ wildcard in the search term change the query's parameter structure (SQL injection / structure safety)", async () => {
    const { pool, queryFn } = mockPagedContactPool(1, [contactRow()]);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get(`/api/v2/admin/contact/search/search-company?${new URLSearchParams({ company: "'; DROP TABLE contact; --" }).toString()}`)
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    const pageCall = findQueryCall(queryFn, (sql) => !sql.includes('COUNT(*)'));
    // The malicious string is passed as a bound parameter, never concatenated into the SQL text.
    expect(pageCall[0]).toBe('SELECT * FROM contact WHERE company LIKE ? LIMIT ? OFFSET ?');
    expect(pageCall[1]?.[0]).toBe("%'; DROP TABLE contact; --%");
  });
});
