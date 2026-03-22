import { apiClient } from '@/lib/api-client';
import type { TokenResponse, AuthUser, LoginForm, RegisterForm } from '@/types/auth.types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

export const googleRedirectUrl = `${BASE_URL}/auth/google`;

export const authApi = {
  login: (data: LoginForm) =>
    apiClient.post<TokenResponse>('/auth/login', data).then((r) => r.data),

  register: (data: RegisterForm) =>
    apiClient.post<TokenResponse>('/auth/register', data).then((r) => r.data),

  logout: () =>
    apiClient.post('/auth/logout').then((r) => r.data),

  me: () =>
    apiClient.get<AuthUser>('/auth/me').then((r) => r.data),
};
