import { IsString, Length } from 'class-validator';

export class GoogleExchangeDto {
  // C2: one-time OAuth code returned as `?code=` by /auth/google/callback.
  @IsString()
  @Length(32, 128)
  code!: string;
}
