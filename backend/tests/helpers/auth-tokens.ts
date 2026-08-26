import jwt from 'jsonwebtoken';

/** Must match TEST_ENV_SOURCE.JWT_SECRET in build-test-app.ts. */
export const TEST_JWT_SECRET = 'test-only-secret-not-for-real-use';

export interface TestTokenOverrides {
  sub?: number;
  email?: string;
}

/** A valid, unexpired JWT for a normal (non-admin) logged-in user. */
export function normalUserToken(overrides: TestTokenOverrides = {}): string {
  return jwt.sign(
    { sub: 1, email: 'user@example.com', isAdmin: false, ...overrides },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

/** A valid, unexpired JWT for an admin user (`isAdmin: true`). */
export function adminUserToken(overrides: TestTokenOverrides = {}): string {
  return jwt.sign(
    { sub: 2, email: 'admin@example.com', isAdmin: true, ...overrides },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

/** An already-expired JWT — for asserting authenticate() rejects it with 401. */
export function expiredToken(overrides: TestTokenOverrides = {}): string {
  return jwt.sign(
    { sub: 1, email: 'user@example.com', isAdmin: false, ...overrides },
    TEST_JWT_SECRET,
    { expiresIn: -10 },
  );
}
