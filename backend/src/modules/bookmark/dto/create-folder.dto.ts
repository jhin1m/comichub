import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({ example: 'Favorites', maxLength: 50 })
  @IsString()
  @Length(1, 50)
  name!: string;
}
