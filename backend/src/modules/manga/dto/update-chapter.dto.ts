import { PartialType } from '@nestjs/swagger';
import { CreateChapterDto } from './create-chapter.dto.js';

export class UpdateChapterDto extends PartialType(CreateChapterDto) {}
