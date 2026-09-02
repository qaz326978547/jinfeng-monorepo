import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, createMockS3Client } from '../helpers/build-test-app';
import { adminUserToken, normalUserToken } from '../helpers/auth-tokens';

// Mocked so this suite never talks to real AWS — only the presigner call is faked;
// PutObjectCommand/DeleteObjectCommand from @aws-sdk/client-s3 stay real (they're just
// plain request-shape objects until `.send()` is called, and `.send()` is mocked via
// createMockS3Client in admin-carousel.test.ts / here).
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi
    .fn()
    .mockResolvedValue('https://test-bucket.s3.us-east-1.amazonaws.com/carousel/mock-signed-url'),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function validPayload(overrides: Record<string, unknown> = {}) {
  return { fileName: 'photo.webp', contentType: 'image/webp', fileSize: 1024, variant: 'desktop', ...overrides };
}

describe('POST /api/v2/admin/carousels/upload-url', () => {
  beforeEach(() => {
    vi.mocked(getSignedUrl).mockClear();
    vi.mocked(getSignedUrl).mockResolvedValue(
      'https://test-bucket.s3.us-east-1.amazonaws.com/carousel/mock-signed-url',
    );
  });

  it('returns 401 with no Authorization header', async () => {
    const { app } = buildTestApp();

    const res = await request(app).post('/api/v2/admin/carousels/upload-url').send(validPayload());

    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin token', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${normalUserToken()}`)
      .send(validPayload());

    expect(res.status).toBe(403);
  });

  it('desktop variant: returns 200 with a carousel/desktop/ key and matching CDN imageUrl', async () => {
    const { app } = buildTestApp({ s3Client: createMockS3Client() });

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ variant: 'desktop' }));

    expect(res.status).toBe(200);
    // uploadUrl is the presigned PUT target — still a direct-to-S3 URL, never CloudFront.
    expect(res.body.uploadUrl).toBe(
      'https://test-bucket.s3.us-east-1.amazonaws.com/carousel/mock-signed-url',
    );
    expect(res.body.imageKey).toMatch(/^carousel\/desktop\/[0-9a-f-]+\.webp$/);
    // imageUrl (the PUBLIC read URL) is built from AWS_S3_PUBLIC_BASE_URL (CloudFront),
    // never the raw *.s3.<region>.amazonaws.com bucket URL.
    expect(res.body.imageUrl).toBe(`https://cdn.test.example.com/${res.body.imageKey}`);
    expect(res.body.imageUrl).not.toContain('amazonaws.com');
  });

  it('mobile variant: returns 200 with a carousel/mobile/ key and matching CDN imageUrl', async () => {
    const { app } = buildTestApp({ s3Client: createMockS3Client() });

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ variant: 'mobile' }));

    expect(res.status).toBe(200);
    expect(res.body.imageKey).toMatch(/^carousel\/mobile\/[0-9a-f-]+\.webp$/);
    expect(res.body.imageUrl).toBe(`https://cdn.test.example.com/${res.body.imageKey}`);
  });

  it('rejects an invalid variant', async () => {
    const { app } = buildTestApp({ s3Client: createMockS3Client() });

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ variant: 'tablet' }));

    expect(res.status).toBe(400);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects a missing variant', async () => {
    const { app } = buildTestApp({ s3Client: createMockS3Client() });
    const { variant: _variant, ...rest } = validPayload();

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(rest);

    expect(res.status).toBe(400);
  });

  it('maps contentType to the correct extension (image/jpeg -> .jpg)', async () => {
    const { app } = buildTestApp({ s3Client: createMockS3Client() });

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ fileName: 'photo.png', contentType: 'image/jpeg' }));

    expect(res.status).toBe(200);
    expect(res.body.imageKey).toMatch(/\.jpg$/);
  });

  it('never trusts the client-supplied fileName/path — imageKey is always backend-generated', async () => {
    const { app } = buildTestApp({ s3Client: createMockS3Client() });

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ fileName: '../../etc/passwd.webp' }));

    expect(res.status).toBe(200);
    expect(res.body.imageKey).not.toContain('..');
    expect(res.body.imageKey).not.toContain('etc/passwd');
    expect(res.body.imageKey).toMatch(/^carousel\/desktop\/[0-9a-f-]+\.webp$/);
  });

  it('rejects an unsupported content type', async () => {
    const { app } = buildTestApp({ s3Client: createMockS3Client() });

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ fileName: 'a.svg', contentType: 'image/svg+xml' }));

    expect(res.status).toBe(400);
  });

  it('rejects a fileSize over the 5MB limit', async () => {
    const { app } = buildTestApp({ s3Client: createMockS3Client() });

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ fileSize: 6 * 1024 * 1024 }));

    expect(res.status).toBe(400);
  });

  it('rejects a missing fileSize', async () => {
    const { app } = buildTestApp({ s3Client: createMockS3Client() });
    const { fileSize: _fileSize, ...rest } = validPayload();

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(rest);

    expect(res.status).toBe(400);
  });

  it('rejects a missing fileName', async () => {
    const { app } = buildTestApp({ s3Client: createMockS3Client() });
    const { fileName: _fileName, ...rest } = validPayload();

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(rest);

    expect(res.status).toBe(400);
  });

  it('binds ContentLength to the declared fileSize on the presigned PutObjectCommand (enforces the size cap server-side)', async () => {
    const { app } = buildTestApp({ s3Client: createMockS3Client() });

    await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload({ fileSize: 2048 }));

    const call = vi.mocked(getSignedUrl).mock.calls[0]!;
    const command = call[1] as { input: Record<string, unknown> };
    expect(command.input).toMatchObject({ ContentType: 'image/webp', ContentLength: 2048 });
  });

  it('returns 503 when S3 is not configured', async () => {
    const { app } = buildTestApp({ s3Client: null });

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload());

    expect(res.status).toBe(503);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('returns 503 when S3 credentials are configured but AWS_S3_PUBLIC_BASE_URL is not', async () => {
    const { app } = buildTestApp({
      s3Client: createMockS3Client(),
      env: { AWS_S3_PUBLIC_BASE_URL: '' },
    });

    const res = await request(app)
      .post('/api/v2/admin/carousels/upload-url')
      .set('Authorization', `Bearer ${adminUserToken()}`)
      .send(validPayload());

    expect(res.status).toBe(503);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
