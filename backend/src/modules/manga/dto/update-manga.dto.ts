import { PartialType } from '@nestjs/swagger';
import { CreateMangaDto } from './create-manga.dto.js';

export class UpdateMangaDto extends PartialType(CreateMangaDto) {}
