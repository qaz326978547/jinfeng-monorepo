import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type ConsultationCallbackTime = 'anytime' | 'morning' | 'noon' | 'afternoon' | 'evening';
export type ConsultationStatus = 'pending' | 'contacted' | 'completed';

/**
 * Brand-new feature, no legacy parity (same treatment as carousel) — the API
 * contract specifies camelCase field names, so the SELECT aliases snake_case
 * DB columns to camelCase in one place instead of transforming objects in
 * the service/controller layer.
 */
const FULL_COLUMNS = `
  id, name, phone,
  company_name AS companyName, tax_id AS taxId, line_id AS lineId,
  callback_times AS callbackTimes, message, status,
  created_at AS createdAt, updated_at AS updatedAt
`;

interface ConsultationRow extends RowDataPacket {
  id: number;
  name: string;
  phone: string;
  companyName: string | null;
  taxId: string | null;
  lineId: string | null;
  callbackTimes: string | ConsultationCallbackTime[];
  message: string | null;
  status: ConsultationStatus;
  createdAt: string;
  updatedAt: string;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface Consultation {
  id: number;
  name: string;
  phone: string;
  companyName: string | null;
  taxId: string | null;
  lineId: string | null;
  callbackTimes: ConsultationCallbackTime[];
  message: string | null;
  status: ConsultationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationCreateInput {
  name: string;
  phone: string;
  companyName: string | null;
  taxId: string | null;
  lineId: string | null;
  callbackTimes: ConsultationCallbackTime[];
  message: string | null;
}

/**
 * mysql2 does not reliably auto-parse a JSON column back into an object
 * across every driver/config combination, and this repo has no existing
 * JSON-column precedent to copy — parse defensively rather than trust it.
 */
function toConsultation(row: ConsultationRow): Consultation {
  const callbackTimes =
    typeof row.callbackTimes === 'string'
      ? (JSON.parse(row.callbackTimes) as ConsultationCallbackTime[])
      : row.callbackTimes;
  return { ...row, callbackTimes };
}

export class ConsultationRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: number): Promise<Consultation | null> {
    const [rows] = await this.pool.query<ConsultationRow[]>(
      `SELECT ${FULL_COLUMNS} FROM consultations WHERE id = ?`,
      [id],
    );
    return rows[0] ? toConsultation(rows[0]) : null;
  }

  private async findByIdOrThrow(id: number): Promise<Consultation> {
    const row = await this.findById(id);
    if (!row) {
      throw new Error(`consultation ${id} not found immediately after write`);
    }
    return row;
  }

  /**
   * status is intentionally never a parameter here — the DB-level
   * DEFAULT 'pending' (see migrations/007_create_consultations_table.sql)
   * is the only thing that ever sets it on insert, so a public submission
   * can never control it even if a caller bypassed the Zod schema.
   */
  async create(input: ConsultationCreateInput): Promise<Consultation> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO consultations
         (name, phone, company_name, tax_id, line_id, callback_times, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.phone,
        input.companyName,
        input.taxId,
        input.lineId,
        JSON.stringify(input.callbackTimes),
        input.message,
      ],
    );
    return this.findByIdOrThrow(result.insertId);
  }

  async countAll(): Promise<number> {
    const [rows] = await this.pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM consultations');
    return Number(rows[0]?.total ?? 0);
  }

  /** Newest first: ORDER BY id DESC is more reliable than created_at DESC alone
   *  under same-second inserts (auto-increment is strictly monotonic). */
  async findPage(limit: number, offset: number): Promise<Consultation[]> {
    const [rows] = await this.pool.query<ConsultationRow[]>(
      `SELECT ${FULL_COLUMNS} FROM consultations ORDER BY id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return rows.map(toConsultation);
  }

  async updateStatus(id: number, status: ConsultationStatus): Promise<Consultation | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.pool.query('UPDATE consultations SET status = ? WHERE id = ?', [status, id]);
    return this.findByIdOrThrow(id);
  }
}
