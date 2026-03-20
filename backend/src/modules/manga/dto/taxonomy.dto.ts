import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTaxonomyDto {
  @ApiProperty({ example: 'Action' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}

export class UpdateTaxonomyDto extends CreateTaxonomyDto {}
