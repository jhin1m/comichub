export class CommentMentionEvent {
  commentId!: number;
  mentionedUserId!: number;
  mentionerName!: string;
  mentionerAvatar!: string | null;
  mentionPreview!: string;
  mangaSlug!: string | null;
}
