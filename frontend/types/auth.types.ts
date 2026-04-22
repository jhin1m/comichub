export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: number;
  uuid: string;
  email: string;
  name: string;
  avatar: string | null;
  role: 'admin' | 'user';
  hasHistory?: boolean;
  hasBookmark?: boolean;
}

export interface LoginForm {
  email: string;
  password: string;
  turnstileToken?: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
  turnstileToken?: string;
}

export interface ForgotPasswordForm {
  email: string;
  turnstileToken?: string;
}

export interface ResetPasswordForm {
  token: string;
  newPassword: string;
  turnstileToken?: string;
}
