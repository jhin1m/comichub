export interface JwtPayload {
  sub: number;
  uuid: string;
  email: string;
  role: 'admin' | 'user';
}

// H3: refresh token carries a `jti` for reuse detection. Access token doesn't need it.
export interface JwtRefreshPayload extends JwtPayload {
  jti?: string;
}
