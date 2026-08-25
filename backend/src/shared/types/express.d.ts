import 'express';

export interface AuthenticatedUser {
  id: number;
  email: string;
  isAdmin: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    user?: AuthenticatedUser;
  }
}
