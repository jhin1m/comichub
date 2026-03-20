import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class BanUserDto {
  @ApiProperty({
    description: 'Ban expiry date (null = permanent unban)',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsDateString()
  bannedUntil!: string | null;
}
