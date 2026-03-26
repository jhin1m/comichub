export class CommentLikeEvent {
  commentId!: number;
  likerName!: string;
  likerAvatar!: string | null;
  commentOwnerId!: number;
  commentPreview!: string;
  mangaSlug!: string | null;
}
