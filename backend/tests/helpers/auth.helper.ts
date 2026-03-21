/**
 * Generates test JWT access tokens without needing a running NestJS app.
 * Uses the same secret defined in tests/setup.ts.
 */
import { JwtService } from '@nestjs/jwt';

const TEST_ACCESS_SECRET = 'test-access-secret-32-chars-long!!';
const TEST_ACCESS_EXPIRY = '15m';

const jwtService = new JwtService({});

export interface TestUser {
  id: number;
  uuid: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'moderator';
}

/** Default regular user fixture */
export const testUser: TestUser = {
  id: 1,
  uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  email: 'user@test.com',
  name: 'Test User',
  role: 'user',
};

/** Default admin user fixture */
export const testAdmin: TestUser = {
  id: 2,
  uuid: 'ffffffff-0000-1111-2222-333333333333',
  email: 'admin@test.com',
  name: 'Test Admin',
  role: 'admin',
};

/** Generate a signed access token for a given user */
export function generateAccessToken(user: Partial<TestUser> = testUser): string {
  const payload = {
    sub: user.id ?? testUser.id,
    uuid: user.uuid ?? testUser.uuid,
    email: user.email ?? testUser.email,
    role: user.role ?? testUser.role,
  };
  return jwtService.sign(payload, {
    secret: TEST_ACCESS_SECRET,
    expiresIn: TEST_ACCESS_EXPIRY,
  });
}

/** Returns `Authorization: Bearer <token>` header value */
export function bearerToken(user: Partial<TestUser> = testUser): string {
  return `Bearer ${generateAccessToken(user)}`;
}
