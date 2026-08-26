import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Logger } from 'pino';
import { FormRequestValidationError } from '../../shared/errors/form-request-validation-error';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { DuplicateEmailError, type UserRepository } from './user.repository';
import type { RegisterRequest } from './auth.schemas';

const CREDENTIAL_ERROR_MESSAGE = '帳號或密碼錯誤';
const DUPLICATE_EMAIL_MESSAGE = 'email 已被使用';
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

export interface AuthServiceDeps {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptSaltRounds: number;
  repository: UserRepository;
  logger: Logger;
}

export interface LoginResult {
  token: string;
}

/** 60 chars, `$2[aby]$` prefix — bcryptjs itself is inconsistent on malformed
 * input (silently `false` vs. throwing depending on the exact malformation),
 * so the format must be checked independently before calling `compare()`
 * (FR-004, research.md #3). */
export function isSupportedBcryptHash(hash: string): boolean {
  return hash.length === 60 && BCRYPT_HASH_PATTERN.test(hash);
}

/** DB `1` -> true, anything else -> false (FR-014). */
export function mapIsAdmin(value: number): boolean {
  return value === 1;
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly bcryptSaltRounds: number;
  private readonly repository: UserRepository;
  private readonly logger: Logger;

  constructor(deps: AuthServiceDeps) {
    this.jwtSecret = deps.jwtSecret;
    this.jwtExpiresIn = deps.jwtExpiresIn;
    this.bcryptSaltRounds = deps.bcryptSaltRounds;
    this.repository = deps.repository;
    this.logger = deps.logger;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.repository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError(CREDENTIAL_ERROR_MESSAGE);
    }

    if (!isSupportedBcryptHash(user.password)) {
      this.logger.error(
        { code: 'AUTH_PASSWORD_HASH_INTEGRITY_ERROR', userId: user.id },
        'Stored password hash is not a supported bcrypt format',
      );
      throw new Error('Password hash integrity error');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedError(CREDENTIAL_ERROR_MESSAGE);
    }

    const signOptions: SignOptions = {
      // JWT_EXPIRES_IN is validated by Zod against a fixed allowlist
      // (1d/7d/14d/30d — src/config/env.ts) before the app ever starts, so
      // this is always one of those four literal strings here; the cast is
      // just to satisfy jsonwebtoken's `StringValue` type, which this
      // project doesn't otherwise import (spec.md FR-007, research.md #4).
      expiresIn: this.jwtExpiresIn as NonNullable<SignOptions['expiresIn']>,
    };

    const token = jwt.sign(
      { sub: user.id, email: user.email, isAdmin: mapIsAdmin(user.is_admin) },
      this.jwtSecret,
      signOptions,
    );

    return { token };
  }

  /**
   * Legacy contract (api-specification.md #7): insert-only, bcrypt hash,
   * never returns a token or logs the user in — the caller must call
   * login() separately afterwards, matching Laravel's original behavior.
   */
  async register(input: RegisterRequest): Promise<void> {
    const passwordHash = await bcrypt.hash(input.password, this.bcryptSaltRounds);

    try {
      await this.repository.createUser({
        name: input.name,
        email: input.email,
        passwordHash,
        ...(input.is_admin !== undefined ? { isAdmin: input.is_admin } : {}),
      });
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        throw new FormRequestValidationError(DUPLICATE_EMAIL_MESSAGE);
      }
      throw error;
    }
  }
}
