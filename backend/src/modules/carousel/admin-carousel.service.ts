import { DeleteObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Logger } from 'pino';
import { AppError } from '../../shared/errors/app-error';
import {
  buildCarouselImageUrl,
  generateCarouselImageKey,
} from '../../infrastructure/storage/carousel-image-key';
import type { S3Config } from '../../infrastructure/storage/s3.config';
import type { Carousel, CarouselRepository, CarouselWriteInput } from './carousel.repository';
import type { CarouselWriteRequest, UploadUrlRequest } from './admin-carousel.schemas';

const UPLOAD_URL_EXPIRY_SECONDS = 300;

export class S3NotConfiguredError extends AppError {
  constructor() {
    super(503, 'S3_NOT_CONFIGURED', 'AWS S3 尚未設定，請聯繫系統管理員');
  }
}

export interface UploadUrlResult {
  uploadUrl: string;
  imageKey: string;
  imageUrl: string;
}

export type DeleteCarouselResult = 'deleted' | 'not_found';

export class AdminCarouselService {
  constructor(
    private readonly repository: CarouselRepository,
    private readonly s3Client: S3Client | null,
    private readonly s3Config: S3Config,
    private readonly logger: Logger,
  ) {}

  async listAll(): Promise<Carousel[]> {
    return this.repository.findAllForAdmin();
  }

  /**
   * Both desktopImageUrl/mobileImageUrl are always derived from AWS_S3_PUBLIC_BASE_URL +
   * the client-supplied key — never trusted from the request body (see
   * admin-carousel.schemas.ts). This requires the CDN origin to be configured even for a
   * metadata-only write, since every write recomputes both URLs from their keys.
   */
  private toWriteInput(input: CarouselWriteRequest): CarouselWriteInput {
    if (!this.s3Config.publicBaseUrl) {
      throw new S3NotConfiguredError();
    }
    return {
      title: input.title,
      desktopImageKey: input.desktopImageKey,
      desktopImageUrl: buildCarouselImageUrl(this.s3Config.publicBaseUrl, input.desktopImageKey),
      mobileImageKey: input.mobileImageKey,
      mobileImageUrl: buildCarouselImageUrl(this.s3Config.publicBaseUrl, input.mobileImageKey),
      linkType: input.linkType,
      linkUrl: input.linkType === 'none' ? null : (input.linkUrl ?? null),
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
  }

  async create(input: CarouselWriteRequest): Promise<Carousel> {
    return this.repository.create(this.toWriteInput(input));
  }

  /**
   * Update flow (requirement order: upload new image(s) first — done by the client calling
   * upload-url + PUT to S3 before this request — update DB, only then delete whichever old
   * image(s) were actually replaced; never delete before the DB write is confirmed).
   *
   * Desktop and mobile are diffed independently: unchanged/desktop-only/mobile-only/both are
   * all just "the client resent the same key" vs "the client resent a different key" per
   * image, so no special-casing per combination is needed. A failed cleanup of an old image
   * is logged and swallowed rather than failing the request — the DB write already succeeded
   * and is the source of truth, so surfacing a 500 here would be misleading. The tradeoff is
   * an orphaned S3 object on failure, an acceptable, logged inconsistency (see plan §11).
   */
  async update(id: number, input: CarouselWriteRequest): Promise<Carousel | null> {
    const previous = await this.repository.findById(id);
    if (!previous) {
      return null;
    }

    const updated = await this.repository.update(id, this.toWriteInput(input));
    if (!updated) {
      return null;
    }

    const replacedImageKeys: string[] = [];
    if (previous.desktopImageKey !== updated.desktopImageKey) {
      replacedImageKeys.push(previous.desktopImageKey);
    }
    if (previous.mobileImageKey !== updated.mobileImageKey) {
      replacedImageKeys.push(previous.mobileImageKey);
    }

    for (const imageKey of replacedImageKeys) {
      try {
        await this.deleteImageFromS3(imageKey);
      } catch (error) {
        this.logger.error(
          { err: error, imageKey, carouselId: id },
          'failed to delete replaced carousel image from S3 — orphaned object left behind',
        );
      }
    }

    return updated;
  }

  /**
   * Delete flow (requirement order): read the record, delete BOTH S3 objects, only then
   * delete the DB row. A real S3 failure (permissions/network — DeleteObjectCommand does
   * NOT error when the key is simply already missing, S3 treats that as success) throws and
   * propagates to a 500, leaving the DB row intact — no "deleted from DB but maybe still in
   * S3" ambiguity. If desktop deletes but mobile then fails, the DB row (with both keys)
   * still exists and a retry is safe: re-deleting the already-gone desktop key is a no-op,
   * and mobile gets another attempt — there is no distributed-transaction primitive across
   * S3 + MySQL, so this retry-is-idempotent property is the practical consistency guarantee.
   */
  async deleteById(id: number): Promise<DeleteCarouselResult> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      return 'not_found';
    }

    await this.deleteImageFromS3(existing.desktopImageKey);
    await this.deleteImageFromS3(existing.mobileImageKey);

    const deleted = await this.repository.deleteById(id);
    if (!deleted) {
      this.logger.warn(
        { carouselId: id },
        'carousel row was already gone when deleting from DB after S3 cleanup succeeded (concurrent delete)',
      );
    }
    return 'deleted';
  }

  private async deleteImageFromS3(imageKey: string): Promise<void> {
    if (!this.s3Client) {
      throw new S3NotConfiguredError();
    }
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.s3Config.bucket, Key: imageKey }),
      );
    } catch (error) {
      this.logger.error({ err: error, imageKey }, 'failed to delete carousel image from S3');
      throw new AppError(500, 'S3_DELETE_FAILED', '刪除圖片失敗，請稍後再試');
    }
  }

  async createUploadUrl(input: UploadUrlRequest): Promise<UploadUrlResult> {
    // Presigned PUT still needs a real S3Client (bucket/region/credentials); the resulting
    // public imageUrl separately needs the CloudFront origin — both must be configured.
    if (!this.s3Client || !this.s3Config.publicBaseUrl) {
      throw new S3NotConfiguredError();
    }

    const imageKey = generateCarouselImageKey(input.variant, input.contentType);
    const command = new PutObjectCommand({
      Bucket: this.s3Config.bucket,
      Key: imageKey,
      ContentType: input.contentType,
      // Binds the declared file size into the signature — S3 rejects a PUT whose actual
      // Content-Length doesn't match, which is how the 5MB cap (enforced by
      // uploadUrlRequestSchema at request time) is actually kept honest against a client
      // that lies about size after fetching the URL.
      ContentLength: input.fileSize,
    });

    let uploadUrl: string;
    try {
      // Presigned URL is signed straight against S3 (bucket + region + credentials) — never
      // routed through CloudFront, which only serves reads.
      uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
      });
    } catch (error) {
      this.logger.error({ err: error }, 'failed to create carousel upload presigned URL');
      throw new AppError(500, 'S3_PRESIGN_FAILED', '產生上傳網址失敗，請稍後再試');
    }

    return {
      uploadUrl,
      imageKey,
      imageUrl: buildCarouselImageUrl(this.s3Config.publicBaseUrl, imageKey),
    };
  }
}
