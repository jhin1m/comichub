import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { MyProfile } from '@/types/user.types';

interface ProfileHeaderProps {
  profile: MyProfile;
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-6 items-start">
      <Avatar src={profile.avatar ?? undefined} fallback={profile.name} size="lg" />
      <div className="space-y-2 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-rajdhani font-bold text-2xl text-primary">{profile.name}</h1>
          <Badge variant={profile.role === 'admin' ? 'accent' : 'default'}>
            {profile.role}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-secondary">
          <span>Lv. {profile.level}</span>
          <span>{profile.xp} XP</span>
        </div>
        {profile.profile?.bio && (
          <p className="text-sm text-secondary max-w-lg">{profile.profile.bio}</p>
        )}
        <p className="text-xs text-muted">Joined {formatDate(profile.createdAt)}</p>
      </div>
    </div>
  );
}
