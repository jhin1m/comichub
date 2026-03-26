export class NewChapterEvent {
  mangaId!: number;
  mangaTitle!: string;
  mangaSlug!: string;
  chapterId!: number;
  chapterNumber!: number;
  mangaCover!: string | null;
}
