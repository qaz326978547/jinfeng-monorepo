import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Logger } from 'pino';
import { UnauthorizedError } from '../../shared/errors/app-error';
import type { UserRepository } from './user.repository';

const CREDENTIAL_ERROR_MESSAGE = '帳號或密碼錯誤';
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

export interface AuthServiceDeps {
  jwtSecret: string;
  jwtExpiresIn: string;
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
  private readonly repository: UserRepository;
  private readonly logger: Logger;

  constructor(deps: AuthServiceDeps) {
    this.jwtSecret = deps.jwtSecret;
    this.jwtExpiresIn = deps.jwtExpiresIn;
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
      // JWT_EXPIRES_IN is only validated by Zod as a non-empty string
      // (src/config/env.ts); its concrete duration-string format is
      // validated by jsonwebtoken itself at sign time, not narrowed to
      // `ms`'s StringValue type here — an invalid value surfaces as a
      // thrown error from this call, not at startup (spec.md FR-007,
      // research.md #4).
      expiresIn: this.jwtExpiresIn as NonNullable<SignOptions['expiresIn']>,
    };

    const token = jwt.sign(
      { sub: user.id, email: user.email, isAdmin: mapIsAdmin(user.is_admin) },
      this.jwtSecret,
      signOptions,
    );

    return { token };
  }
}
