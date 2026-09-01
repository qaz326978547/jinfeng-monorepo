import type { Env } from '../../config/env';

export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function buildS3Config(env: Env): S3Config {
  return {
    region: env.AWS_REGION,
    bucket: env.AWS_S3_BUCKET,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  };
}
