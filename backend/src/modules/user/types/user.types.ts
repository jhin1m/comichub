export interface PublicUserProfile {
  uuid: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  joinedAt: Date;
  followsCount: number;
}

export interface MyProfile {
  id: number;
  uuid: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  xp: number;
  level: number;
  bannedUntil: Date | null;
  createdAt: Date;
  profile: {
    bio: string | null;
    website: string | null;
    twitter: string | null;
    discord: string | null;
  } | null;
}

export interface FollowItem {
  id: number;
  mangaId: number;
  manga: {
    id: number;
    title: string;
    slug: string;
    cover: string | null;
    status: string;
    followersCount: number;
  };
  createdAt: Date;
}

export interface HistoryItem {
  id: number;
  mangaId: number;
  chapterId: number | null;
  lastReadAt: Date;
  manga: {
    id: number;
    title: string;
    slug: string;
    cover: string | null;
  };
  chapter: {
    id: number;
    number: string;
    title: string | null;
  } | null;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
