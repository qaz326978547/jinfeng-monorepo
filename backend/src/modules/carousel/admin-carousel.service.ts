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

function toWriteInput(input: CarouselWriteRequest): CarouselWriteInput {
  return {
    title: input.title,
    imageUrl: input.imageUrl,
    imageKey: input.imageKey,
    linkType: input.linkType,
    linkUrl: input.linkType === 'none' ? null : (input.linkUrl ?? null),
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  };
}

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

  async create(input: CarouselWriteRequest): Promise<Carousel> {
    return this.repository.create(toWriteInput(input));
  }

  /**
   * Update-image flow (requirement order: upload new image first, update DB, only then
   * delete the old image — never delete before the DB write is confirmed). If the old
   * image's S3 delete fails after a successful DB update, it is logged and swallowed
   * rather than failing the request: the DB write already succeeded and is the source of
   * truth, so surfacing a 500 here would be misleading. The tradeoff is an orphaned S3
   * object on failure, which is an acceptable, logged inconsistency (see plan §11).
   */
  async update(id: number, input: CarouselWriteRequest): Promise<Carousel | null> {
    const previous = await this.repository.findById(id);
    if (!previous) {
      return null;
    }

    const updated = await this.repository.update(id, toWriteInput(input));
    if (updated && previous.imageKey !== updated.imageKey) {
      try {
        await this.deleteImageFromS3(previous.imageKey);
      } catch (error) {
        this.logger.error(
          { err: error, imageKey: previous.imageKey, carouselId: id },
          'failed to delete replaced carousel image from S3 — orphaned object left behind',
        );
      }
    }
    return updated;
  }

  /**
   * Delete flow (requirement order): read the record, delete the S3 object, only then
   * delete the DB row. A real S3 failure (permissions/network — DeleteObjectCommand does
   * NOT error when the key is simply already missing, S3 treats that as success) throws
   * and propagates to a 500, leaving the DB row intact so there is no "deleted from DB but
   * maybe still in S3, maybe not" ambiguity.
   */
  async deleteById(id: number): Promise<DeleteCarouselResult> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      return 'not_found';
    }

    await this.deleteImageFromS3(existing.imageKey);

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
    if (!this.s3Client) {
      throw new S3NotConfiguredError();
    }

    const imageKey = generateCarouselImageKey(input.contentType);
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
      imageUrl: buildCarouselImageUrl(this.s3Config.bucket, this.s3Config.region, imageKey),
    };
  }
}
