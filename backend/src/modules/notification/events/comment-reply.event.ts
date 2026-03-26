export class CommentReplyEvent {
  commentId!: number;
  replyAuthorName!: string;
  replyAuthorAvatar!: string | null;
  replyContent!: string;
  mangaId!: number | null;
  mangaSlug!: string | null;
  commentOwnerId!: number;
}
