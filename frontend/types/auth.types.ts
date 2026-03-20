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
}

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
}
