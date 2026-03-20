export interface MyProfile {
  id: number;
  uuid: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  xp: number;
  level: number;
  bannedUntil: string | null;
  createdAt: string;
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
  createdAt: string;
}

export interface HistoryItem {
  id: number;
  mangaId: number;
  chapterId: number | null;
  lastReadAt: string;
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
