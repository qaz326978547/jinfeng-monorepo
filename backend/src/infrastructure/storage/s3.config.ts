import type { Env } from '../../config/env';

export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** CloudFront origin for public reads, e.g. https://cdn.laborservice5690.com — never the
   *  bucket's own *.s3.<region>.amazonaws.com URL (the bucket is private). */
  publicBaseUrl: string;
}

export function buildS3Config(env: Env): S3Config {
  return {
    region: env.AWS_REGION,
    bucket: env.AWS_S3_BUCKET,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    publicBaseUrl: env.AWS_S3_PUBLIC_BASE_URL,
  };
}
