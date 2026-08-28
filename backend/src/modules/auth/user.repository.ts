import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  password: string;
  is_admin: number;
}

export interface CreateUserInput {
  name: string;
  email: string;
  /** Already-hashed (bcrypt) — this repository never hashes anything itself. */
  passwordHash: string;
  /** When omitted, `is_admin` is left out of the INSERT entirely so the table's own DEFAULT 0 applies. */
  isAdmin?: boolean;
}

/**
 * Thrown when an INSERT into `users` violates the `users_email_unique`
 * constraint. Kept DB-agnostic of HTTP concerns — callers (auth.service.ts)
 * translate this into the FormRequestValidationError the route contract
 * requires.
 */
export class DuplicateEmailError extends Error {
  constructor() {
    super('users.email unique constraint violated');
    this.name = 'DuplicateEmailError';
  }
}

interface MysqlQueryError {
  code?: string;
  sqlMessage?: string;
}

/**
 * `users` has exactly one unique key besides its auto-increment PK:
 * `users_email_unique` on `email` (backend/migrations/001_create_tables.sql).
 * Matching the constraint's own name in the driver's error message — a
 * stable identifier this codebase itself defined — is how ER_DUP_ENTRY is
 * reliably attributed to the email column specifically, rather than assumed
 * from the generic MySQL error code alone (which numerous different unique
 * constraints could raise if this table ever gains another one).
 */
function isDuplicateEmailError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { code, sqlMessage } = error as MysqlQueryError;
  return code === 'ER_DUP_ENTRY' && typeof sqlMessage === 'string' && sqlMessage.includes('users_email_unique');
}

export class UserRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    const [rows] = await this.pool.query<UserRow[]>(
      'SELECT id, email, password, is_admin FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    return rows[0] ?? null;
  }

  /** @throws {DuplicateEmailError} when `email` already exists. */
  async createUser(input: CreateUserInput): Promise<number> {
    const columns = ['name', 'email', 'password'];
    const values: unknown[] = [input.name, input.email, input.passwordHash];
    if (input.isAdmin !== undefined) {
      columns.push('is_admin');
      values.push(input.isAdmin ? 1 : 0);
    }

    try {
      const [result] = await this.pool.query<ResultSetHeader>(
        `INSERT INTO users (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values,
      );
      return result.insertId;
    } catch (error) {
      if (isDuplicateEmailError(error)) {
        throw new DuplicateEmailError();
      }
      throw error;
    }
  }
}
