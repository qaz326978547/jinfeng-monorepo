import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockPool, createMockS3Client } from '../helpers/build-test-app';
import { adminUserToken, normalUserToken } from '../helpers/auth-tokens';

function carouselRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: '講座宣傳圖',
    imageKey: 'carousel/existing.webp',
    imageUrl: 'https://bucket.s3.ap-northeast-1.amazonaws.com/carousel/existing.webp',
    linkType: 'internal',
    linkUrl: '/about',
    sortOrder: 1,
    isActive: 1,
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
    ...overrides,
  };
}

function validWritePayload(overrides: Record<string, unknown> = {}) {
  return {
    title: '新輪播圖',
    imageUrl: 'https://bucket.s3.ap-northeast-1.amazonaws.com/carousel/new.webp',
    imageKey: 'carousel/new.webp',
    linkType: 'internal',
    linkUrl: '/about',
    sortOrder: 1,
    isActive: true,
    ...overrides,
  };
}

describe('GET /api/v2/admin/carousels', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/v2/admin/carousels');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin token', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .get('/api/v2/admin/carousels')
      .set('Authorization', `Bearer ${normalUserToken()}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 { data: [...] } including inactive rows, for an admin token', async () => {
    const rows = [carouselRow({ isActive: 1 }), carouselRow({ id: 2, isActive: 0 })];
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([rows, []]) });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .get('/api/v2/admin/carousels')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        { ...rows[0], isActive: true },
        { ...rows[1], isActive: false },
      ],
    });
  });

  it('orders by sort_order then id, with no is_active filter (unlike the public endpoint)', async () => {
    const queryFn = vi.fn().mockResolvedValue([[], []]);
    const pool = createMockPool({ query: queryFn });
    const { app } = buildTestApp({ pool });

    await request(app)
      .get('/api/v2/admin/carousels')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    const sql = queryFn.mock.calls[0]?.[0] as string;
    expect(sql).toContain('ORDER BY sort_order ASC, id ASC');
    expect(sql).not.toContain('WHERE is_active');
  });
});

function mockCreatePool(finalRow: Record<string, unknown>) {
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('INSERT INTO carousel')) {
      return Promise.resolve([{ insertId: finalRow.id, affectedRows: 1 }, []]);
    }
    if (sql.includes('FROM carousel WHERE id = ?')) {
      return Promise.resolve([[finalRow], []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return { pool: createMockPool({ query: queryFn }), queryFn };
}

describe('POST /api/v2/admin/carousels', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/api/v2/admin/carousels').send(validWritePayload());
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin token', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/v2/admin/carousels')
      .set('Authorization', `Bearer ${normalUserToken()}`)
      .send(validWritePayload());
    expect(res.status).toBe(403);
  });

  it('returns 201 { message, data } on success', async () => {
    const row = carouselRow({ id: 5, isActive: 1 });
    const { pool } = mockCreatePool(row);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .post('/api/v2/admin/carousels')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validWritePayload());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: '新增成功', data: { ...row, isActive: true } });
  });

  it('rejects a missing title with the FormRequest-compatible 400 shape', async () => {
    const { app } = buildTestApp();
    const { title: _title, ...rest } = validWritePayload();

    const res = await request(app)
      .post('/api/v2/admin/carousels')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(rest);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'title 為必填欄位' });
  });

  it('rejects an invalid linkType', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/carousels')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validWritePayload({ linkType: 'javascript' }));

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('rejects linkType=external with a non-http(s) linkUrl', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/carousels')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validWritePayload({ linkType: 'external', linkUrl: 'javascript:alert(1)' }));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('linkUrl');
  });

  it('accepts linkType=external with a valid https linkUrl', async () => {
    const row = carouselRow({ id: 6, linkType: 'external', linkUrl: 'https://example.com' });
    const { pool } = mockCreatePool(row);
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .post('/api/v2/admin/carousels')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validWritePayload({ linkType: 'external', linkUrl: 'https://example.com' }));

    expect(res.status).toBe(201);
  });

  it('rejects linkType=internal with a linkUrl that does not start with /', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/carousels')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validWritePayload({ linkType: 'internal', linkUrl: 'about' }));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('linkUrl');
  });

  it('rejects a non-integer sortOrder', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/carousels')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validWritePayload({ sortOrder: 1.5 }));

    expect(res.status).toBe(400);
  });

  it('rejects a missing isActive', async () => {
    const { app } = buildTestApp();
    const { isActive: _isActive, ...rest } = validWritePayload();

    const res = await request(app)
      .post('/api/v2/admin/carousels')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(rest);

    expect(res.status).toBe(400);
  });
});

function mockUpdatePool(options: { existing: Record<string, unknown> | null; finalRow: Record<string, unknown> }) {
  let selectCallCount = 0;
  const queryFn = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('UPDATE carousel')) {
      return Promise.resolve([{ affectedRows: 1 }, []]);
    }
    if (sql.includes('FROM carousel WHERE id = ?')) {
      selectCallCount += 1;
      if (selectCallCount === 1) {
        return Promise.resolve([options.existing ? [options.existing] : [], []]);
      }
      return Promise.resolve([[options.finalRow], []]);
    }
    throw new Error(`unexpected query in test: ${sql}`);
  });
  return { pool: createMockPool({ query: queryFn }), queryFn };
}

describe('PUT /api/v2/admin/carousels/:id', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();
    const res = await request(app).put('/api/v2/admin/carousels/1').send(validWritePayload());
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin token', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .put('/api/v2/admin/carousels/1')
      .set('Authorization', `Bearer ${normalUserToken()}`)
      .send(validWritePayload());
    expect(res.status).toBe(403);
  });

  it('returns 200 { message, data } when the image key is unchanged (no S3 call)', async () => {
    const existing = carouselRow({ id: 1, imageKey: 'carousel/same.webp' });
    const updated = carouselRow({ id: 1, title: '更新標題', imageKey: 'carousel/same.webp' });
    const { pool } = mockUpdatePool({ existing, finalRow: updated });
    const s3Client = createMockS3Client();
    const { app } = buildTestApp({ pool, s3Client });

    const res = await request(app)
      .put('/api/v2/admin/carousels/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validWritePayload({ title: '更新標題', imageKey: 'carousel/same.webp' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: '更新成功', data: { ...updated, isActive: true } });
    expect(s3Client.send).not.toHaveBeenCalled();
  });

  it('deletes the OLD image from S3 only after the DB update succeeds, when the image key changes', async () => {
    const existing = carouselRow({ id: 1, imageKey: 'carousel/old.webp' });
    const updated = carouselRow({ id: 1, imageKey: 'carousel/new.webp' });
    const { pool } = mockUpdatePool({ existing, finalRow: updated });
    const send = vi.fn().mockResolvedValue({});
    const s3Client = createMockS3Client({ send });
    const { app } = buildTestApp({ pool, s3Client });

    const res = await request(app)
      .put('/api/v2/admin/carousels/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validWritePayload({ imageKey: 'carousel/new.webp', imageUrl: updated.imageUrl }));

    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    const deleteInput = send.mock.calls[0]![0].input;
    expect(deleteInput).toMatchObject({ Key: 'carousel/old.webp' });
  });

  it('still returns 200 with the update even if deleting the old S3 image fails (logged, not fatal)', async () => {
    const existing = carouselRow({ id: 1, imageKey: 'carousel/old.webp' });
    const updated = carouselRow({ id: 1, imageKey: 'carousel/new.webp' });
    const { pool } = mockUpdatePool({ existing, finalRow: updated });
    const s3Client = createMockS3Client({ send: vi.fn().mockRejectedValue(new Error('S3 down')) });
    const { app } = buildTestApp({ pool, s3Client });

    const res = await request(app)
      .put('/api/v2/admin/carousels/1')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validWritePayload({ imageKey: 'carousel/new.webp', imageUrl: updated.imageUrl }));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('更新成功');
  });

  it('returns 404 for a nonexistent id and never issues an UPDATE', async () => {
    const { pool, queryFn } = mockUpdatePool({ existing: null, finalRow: carouselRow() });
    const { app } = buildTestApp({ pool });

    const res = await request(app)
      .put('/api/v2/admin/carousels/999')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validWritePayload());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '找不到資料' });
    expect(queryFn.mock.calls.some(([sql]) => (sql as string).startsWith('UPDATE carousel'))).toBe(
      false,
    );
  });

  it('rejects a non-integer id in the path', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .put('/api/v2/admin/carousels/abc')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validWritePayload());

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v2/admin/carousels/:id', () => {
  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();
    const res = await request(app).delete('/api/v2/admin/carousels/1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin token', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .delete('/api/v2/admin/carousels/1')
      .set('Authorization', `Bearer ${normalUserToken()}`);
    expect(res.status).toBe(403);
  });

  it('reads the record, deletes the S3 object, then deletes the DB row, in that order', async () => {
    const existing = carouselRow({ id: 1, imageKey: 'carousel/to-delete.webp' });
    const calls: string[] = [];
    const send = vi.fn().mockImplementation(() => {
      calls.push('s3-delete');
      return Promise.resolve({});
    });
    const queryFn = vi.fn().mockImplementation((sql: string) => {
      if (sql.startsWith('DELETE FROM carousel')) {
        calls.push('db-delete');
        return Promise.resolve([{ affectedRows: 1 }, []]);
      }
      if (sql.includes('FROM carousel WHERE id = ?')) {
        return Promise.resolve([[existing], []]);
      }
      throw new Error(`unexpected query in test: ${sql}`);
    });
    const pool = createMockPool({ query: queryFn });
    const s3Client = createMockS3Client({ send });
    const { app } = buildTestApp({ pool, s3Client });

    const res = await request(app)
      .delete('/api/v2/admin/carousels/1')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: '刪除成功' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].input).toMatchObject({ Key: 'carousel/to-delete.webp' });
    expect(calls).toEqual(['s3-delete', 'db-delete']);
  });

  it('returns 404 for a nonexistent id and never calls S3', async () => {
    const queryFn = vi.fn().mockResolvedValue([[], []]);
    const pool = createMockPool({ query: queryFn });
    const send = vi.fn();
    const s3Client = createMockS3Client({ send });
    const { app } = buildTestApp({ pool, s3Client });

    const res = await request(app)
      .delete('/api/v2/admin/carousels/999')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: '找不到資料' });
    expect(send).not.toHaveBeenCalled();
  });

  it('returns 500 and does NOT delete the DB row when the S3 delete genuinely fails', async () => {
    const existing = carouselRow({ id: 1, imageKey: 'carousel/to-delete.webp' });
    const queryFn = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM carousel WHERE id = ?')) {
        return Promise.resolve([[existing], []]);
      }
      throw new Error(`unexpected query in test: ${sql}`);
    });
    const pool = createMockPool({ query: queryFn });
    const s3Client = createMockS3Client({ send: vi.fn().mockRejectedValue(new Error('S3 down')) });
    const { app } = buildTestApp({ pool, s3Client });

    const res = await request(app)
      .delete('/api/v2/admin/carousels/1')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(500);
    expect(queryFn.mock.calls.some(([sql]) => (sql as string).startsWith('DELETE FROM carousel'))).toBe(
      false,
    );
  });

  it('returns 503 when S3 is not configured', async () => {
    const existing = carouselRow({ id: 1 });
    const pool = createMockPool({ query: vi.fn().mockResolvedValue([[existing], []]) });
    const { app } = buildTestApp({ pool, s3Client: null });

    const res = await request(app)
      .delete('/api/v2/admin/carousels/1')
      .set('Authorization', `Bearer ${adminUserToken()}`);

    expect(res.status).toBe(503);
  });
});
