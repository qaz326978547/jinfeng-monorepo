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
  image_key AS imageKey, image_url AS imageUrl,
  link_type AS linkType, link_url AS linkUrl,
  sort_order AS sortOrder, is_active AS isActive,
  created_at AS createdAt, updated_at AS updatedAt
`;

interface CarouselRow extends RowDataPacket {
  id: number;
  title: string;
  imageKey: string;
  imageUrl: string;
  linkType: CarouselLinkType;
  linkUrl: string | null;
  sortOrder: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCarouselRow extends RowDataPacket {
  id: number;
  title: string;
  imageUrl: string;
  linkType: CarouselLinkType;
  linkUrl: string | null;
}

export interface Carousel {
  id: number;
  title: string;
  imageKey: string;
  imageUrl: string;
  linkType: CarouselLinkType;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CarouselWriteInput {
  title: string;
  imageUrl: string;
  imageKey: string;
  linkType: CarouselLinkType;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** MySQL has no native boolean — TINYINT(1) comes back as 0/1, mapped to a real boolean here. */
function toCarousel(row: CarouselRow): Carousel {
  return { ...row, isActive: Boolean(row.isActive) };
}

export class CarouselRepository {
  constructor(private readonly pool: Pool) {}

  /** Public homepage endpoint: only active slides, only the columns the frontend needs. */
  async findAllActiveForPublic(): Promise<PublicCarouselRow[]> {
    const [rows] = await this.pool.query<PublicCarouselRow[]>(
      `SELECT id, title, image_url AS imageUrl, link_type AS linkType, link_url AS linkUrl
       FROM carousel
       WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`,
    );
    return rows;
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
      `INSERT INTO carousel (title, image_key, image_url, link_type, link_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.title,
        input.imageKey,
        input.imageUrl,
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
       SET title = ?, image_key = ?, image_url = ?, link_type = ?, link_url = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [
        input.title,
        input.imageKey,
        input.imageUrl,
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
