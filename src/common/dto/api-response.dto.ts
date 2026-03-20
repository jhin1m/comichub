import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class ApiResponseDto<T = unknown> {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  data!: T;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional()
  meta?: PaginationMeta;
}
