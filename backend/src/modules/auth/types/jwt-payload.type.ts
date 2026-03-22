export interface JwtPayload {
  sub: number;
  uuid: string;
  email: string;
  role: 'admin' | 'user';
}

// Same shape as JwtPayload — differentiated by signing secret
export type JwtRefreshPayload = JwtPayload;
