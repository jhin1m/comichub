import { PixelAvatar, PixelBadge } from '@pxlkit/ui-kit';
import { formatDate } from '@/lib/utils';
import type { MyProfile } from '@/types/user.types';

interface ProfileHeaderProps {
  profile: MyProfile;
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-6 items-start">
      <PixelAvatar src={profile.avatar ?? undefined} name={profile.name} size="lg" />
      <div className="space-y-2 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-rajdhani font-bold text-2xl text-[#f5f5f5]">{profile.name}</h1>
          <PixelBadge tone={profile.role === 'admin' ? 'red' : 'neutral'}>
            {profile.role}
          </PixelBadge>
        </div>
        <div className="flex items-center gap-4 text-sm text-[#a0a0a0]">
          <span>Lv. {profile.level}</span>
          <span>{profile.xp} XP</span>
        </div>
        {profile.profile?.bio && (
          <p className="text-sm text-[#c0c0c0] max-w-lg">{profile.profile.bio}</p>
        )}
        <p className="text-xs text-[#5a5a5a]">Joined {formatDate(profile.createdAt)}</p>
      </div>
    </div>
  );
}
