import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type CarouselLinkType = 'internal' | 'external' | 'none';

/**
 * DB columns are snake_case (standard SQL convention), but the API contract for this
 * feature (new, no legacy parity — unlike contact/faq which mirror Laravel's snake_case
 * JSON) explicitly specifies camelCase field names. Aliasing in the SELECT keeps that
 * mapping in one place instead of transforming objects in the service/controller layer.
 */
const FULL_COLUMNS = `
  id, title,
  desktop_image_key AS desktopImageKey, desktop_image_url AS desktopImageUrl,
  mobile_image_key AS mobileImageKey, mobile_image_url AS mobileImageUrl,
  link_type AS linkType, link_url AS linkUrl,
  sort_order AS sortOrder, is_active AS isActive,
  created_at AS createdAt, updated_at AS updatedAt
`;

interface CarouselRow extends RowDataPacket {
  id: number;
  title: string;
  desktopImageKey: string;
  desktopImageUrl: string;
  mobileImageKey: string;
  mobileImageUrl: string;
  linkType: CarouselLinkType;
  linkUrl: string | null;
  sortOrder: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

interface PublicCarouselRow extends RowDataPacket {
  id: number;
  title: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  linkType: CarouselLinkType;
  linkUrl: string | null;
  sortOrder: number;
  isActive: number;
}

export interface Carousel {
  id: number;
  title: string;
  desktopImageKey: string;
  desktopImageUrl: string;
  mobileImageKey: string;
  mobileImageUrl: string;
  linkType: CarouselLinkType;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Admin API only omits imageKey/imageUrl-style ambiguity — the public endpoint never
 *  returns *ImageKey (no reason for the frontend to know S3 object keys). */
export interface PublicCarousel {
  id: number;
  title: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  linkType: CarouselLinkType;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CarouselWriteInput {
  title: string;
  desktopImageKey: string;
  desktopImageUrl: string;
  mobileImageKey: string;
  mobileImageUrl: string;
  linkType: CarouselLinkType;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** MySQL has no native boolean — TINYINT(1) comes back as 0/1, mapped to a real boolean here. */
function toCarousel(row: CarouselRow): Carousel {
  return { ...row, isActive: Boolean(row.isActive) };
}

function toPublicCarousel(row: PublicCarouselRow): PublicCarousel {
  return { ...row, isActive: Boolean(row.isActive) };
}

export class CarouselRepository {
  constructor(private readonly pool: Pool) {}

  /** Public homepage endpoint: only active slides, only the columns the frontend needs —
   *  never desktopImageKey/mobileImageKey (S3 object keys are an admin/backend concern). */
  async findAllActiveForPublic(): Promise<PublicCarousel[]> {
    const [rows] = await this.pool.query<PublicCarouselRow[]>(
      `SELECT id, title,
              desktop_image_url AS desktopImageUrl,
              mobile_image_url AS mobileImageUrl,
              link_type AS linkType, link_url AS linkUrl,
              sort_order AS sortOrder, is_active AS isActive
       FROM carousel
       WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`,
    );
    return rows.map(toPublicCarousel);
  }

  async findAllForAdmin(): Promise<Carousel[]> {
    const [rows] = await this.pool.query<CarouselRow[]>(
      `SELECT ${FULL_COLUMNS} FROM carousel ORDER BY sort_order ASC, id ASC`,
    );
    return rows.map(toCarousel);
  }

  async findById(id: number): Promise<Carousel | null> {
    const [rows] = await this.pool.query<CarouselRow[]>(
      `SELECT ${FULL_COLUMNS} FROM carousel WHERE id = ?`,
      [id],
    );
    return rows[0] ? toCarousel(rows[0]) : null;
  }

  private async findByIdOrThrow(id: number): Promise<Carousel> {
    const row = await this.findById(id);
    if (!row) {
      throw new Error(`carousel ${id} not found immediately after write`);
    }
    return row;
  }

  async create(input: CarouselWriteInput): Promise<Carousel> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO carousel
         (title, desktop_image_key, desktop_image_url, mobile_image_key, mobile_image_url,
          link_type, link_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.title,
        input.desktopImageKey,
        input.desktopImageUrl,
        input.mobileImageKey,
        input.mobileImageUrl,
        input.linkType,
        input.linkUrl,
        input.sortOrder,
        input.isActive ? 1 : 0,
      ],
    );
    return this.findByIdOrThrow(result.insertId);
  }

  /** Existence check first (null on a nonexistent id) so the controller can 404. */
  async update(id: number, input: CarouselWriteInput): Promise<Carousel | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.pool.query(
      `UPDATE carousel
       SET title = ?, desktop_image_key = ?, desktop_image_url = ?,
           mobile_image_key = ?, mobile_image_url = ?,
           link_type = ?, link_url = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [
        input.title,
        input.desktopImageKey,
        input.desktopImageUrl,
        input.mobileImageKey,
        input.mobileImageUrl,
        input.linkType,
        input.linkUrl,
        input.sortOrder,
        input.isActive ? 1 : 0,
        id,
      ],
    );
    return this.findByIdOrThrow(id);
  }

  /** Hard delete — single row by id (see admin-carousel.service.ts for the S3-then-DB ordering). */
  async deleteById(id: number): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>('DELETE FROM carousel WHERE id = ?', [
      id,
    ]);
    return result.affectedRows > 0;
  }
}
