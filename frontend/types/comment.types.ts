export interface Comment {
  id: number;
  userId: number | null;
  content: string;
  likesCount: number;
  dislikesCount: number;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
  userName: string;
  userAvatar: string | null;
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
