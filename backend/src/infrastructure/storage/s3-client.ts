import { S3Client } from '@aws-sdk/client-s3';
import type { S3Config } from './s3.config';

/**
 * Returns null when AWS_S3_BUCKET (or credentials) are unset — treated as "S3 not
 * configured" (local dev, or before Ops provisions an IAM user), not a startup failure.
 * Callers (admin-carousel routes) must handle a null client by responding 503 rather than
 * crashing. Mirrors infrastructure/mail/mail-transport.ts::createMailTransport.
 */
export function createS3Client(config: S3Config): S3Client | null {
  if (!config.bucket || !config.region || !config.accessKeyId || !config.secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}
