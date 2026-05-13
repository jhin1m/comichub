export type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'rejected';

export interface Comment {
  id: number;
  userId: number | null;
  content: string;
  likesCount: number;
  dislikesCount: number;
  parentId: number | null;
  isPinned: boolean;
  pinnedAt: string | null;
  editedAt: string | null;
  mentionedUserIds: number[];
  moderationStatus: ModerationStatus;
  createdAt: string;
  updatedAt: string;
  userName: string;
  userAvatar: string | null;
  userRole?: 'admin' | 'user';
  isLiked?: boolean;
  isDisliked?: boolean;
  repliesCount?: number;
}

export interface PaginatedComments {
  data: Comment[];
  total: number;
  page: number;
  limit: number;
}

export type CommentSort = 'newest' | 'oldest' | 'best';

export interface CommentQueryParams {
  page?: number;
  limit?: number;
  sort?: CommentSort;
}

export interface CommentRevision {
  id: number;
  content: string;
  editedAt: string;
  editorId: number | null;
  editorName: string | null;
  editorAvatar: string | null;
}

export type CommentReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'sexual_content'
  | 'spoiler'
  | 'misinformation'
  | 'other';

export interface CommentReportPayload {
  reason: CommentReportReason;
  details?: string;
}

export interface MentionUserSuggestion {
  id: number;
  uuid: string;
  name: string;
  avatar: string | null;
}
