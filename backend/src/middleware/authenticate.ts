import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../shared/errors/app-error';
import type { AuthenticatedUser } from '../shared/types/express';

export interface AccessTokenPayload {
  sub: number;
  email: string;
  isAdmin: boolean;
}

function extractBearerToken(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new UnauthorizedError('Missing bearer token');
  }
  return token;
}

/**
 * Verifies the JWT and attaches req.user. Skeleton only: token issuance
 * (login) is not implemented yet, so this middleware has no route wired to
 * it in this phase.
 */
export function authenticate(jwtSecret: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const token = extractBearerToken(req.header('authorization'));
      const decoded = jwt.verify(token, jwtSecret) as unknown as AccessTokenPayload;
      const user: AuthenticatedUser = {
        id: decoded.sub,
        email: decoded.email,
        isAdmin: decoded.isAdmin,
      };
      req.user = user;
      next();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        next(error);
        return;
      }
      next(new UnauthorizedError('Invalid or expired token'));
    }
  };
}
