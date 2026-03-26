import { describe, it, expect } from 'vitest';
import { authApi } from './auth.api';

describe('authApi', () => {
  it('login returns token response', async () => {
    const result = await authApi.login({ email: 'test@example.com', password: 'pass' });
    expect(result).toHaveProperty('accessToken', 'test-access-token');
    expect(result).toHaveProperty('refreshToken', 'test-refresh-token');
  });

  it('register returns token response', async () => {
    const result = await authApi.register({ name: 'Test', email: 'test@example.com', password: 'pass' });
    expect(result).toHaveProperty('accessToken', 'test-access-token');
  });

  it('me returns auth user', async () => {
    const result = await authApi.me();
    expect(result).toHaveProperty('email', 'test@example.com');
    expect(result).toHaveProperty('role', 'user');
  });

  it('logout resolves without error', async () => {
    await expect(authApi.logout()).resolves.toBeNull();
  });
});
