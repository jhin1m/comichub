export interface NotificationItem {
  id: string;
  notifiableType: string;
  notifiableId: number;
  type: 'chapter.created' | 'comment.replied' | 'comment.liked';
  data: ChapterNotificationData | CommentReplyData | CommentLikeData;
  readAt: string | null;
  createdAt: string;
}

export interface ChapterNotificationData {
  mangaId: number;
  mangaTitle: string;
  mangaSlug: string;
  chapterId: number;
  chapterNumber: number;
  mangaCover: string | null;
}

export interface CommentReplyData {
  commentId: number;
  replyAuthorName: string;
  replyAuthorAvatar: string | null;
  replyContent: string;
  mangaId: number | null;
  mangaSlug: string | null;
}

export interface CommentLikeData {
  commentId: number;
  likerName: string;
  likerAvatar: string | null;
  commentPreview: string;
  mangaSlug: string | null;
}

export interface NotificationListResponse {
  data: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SseNotificationEvent {
  type: 'chapter.created' | 'comment.replied' | 'comment.liked' | 'heartbeat';
  [key: string]: unknown;
}
