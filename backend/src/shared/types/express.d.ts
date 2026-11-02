import 'express';

export interface AuthenticatedUser {
  id: number;
  email: string;
  isAdmin: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    /** Rate-limit key: see middleware/client-ip.ts. */
    clientIp: string;
    user?: AuthenticatedUser;
  }
}
