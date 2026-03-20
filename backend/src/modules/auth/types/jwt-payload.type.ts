export interface JwtPayload {
  sub: number;
  uuid: string;
  email: string;
  role: 'admin' | 'user';
}

export interface JwtRefreshPayload extends JwtPayload {
  // same shape, differentiated by secret
}
