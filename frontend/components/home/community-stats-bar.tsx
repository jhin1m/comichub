import { BookOpen, FileText, Lightning, PlusCircle } from '@phosphor-icons/react/ssr';
import { formatCount } from '@/lib/utils';
import type { PlatformStats } from '@/lib/api/stats.api';

interface Props {
  stats: PlatformStats | null;
}

export function CommunityStatsBar({ stats }: Props) {
  if (!stats || stats.totalManga === 0) return null;

  return (
    <div className="max-w-350 mx-auto px-4 md:px-6 lg:px-8 py-4">
      <div className="bg-surface border border-default rounded-lg px-6 py-4 flex justify-center gap-6 md:gap-10 flex-wrap">
        <StatItem
          icon={<BookOpen size={16} />}
          iconClass="bg-accent-muted text-accent"
          value={formatCount(stats.totalManga) + '+'}
          label="manga titles"
        />
        <StatItem
          icon={<FileText size={16} />}
          iconClass="bg-info/12 text-info"
          value={formatCount(stats.totalChapters)}
          label="chapters"
        />
        <StatItem
          icon={<Lightning size={16} />}
          iconClass="bg-warning/12 text-warning"
          value={String(stats.dailyUpdates)}
          label="updated today"
        />
        <StatItem
          icon={<PlusCircle size={16} />}
          iconClass="bg-success/12 text-success"
          value={String(stats.newThisWeek)}
          label="new this week"
        />
      </div>
    </div>
  );
}

function StatItem({ icon, iconClass, value, label }: {
  icon: React.ReactNode;
  iconClass: string;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconClass}`}>
        {icon}
      </div>
      <div>
        <p className="font-rajdhani font-bold text-lg text-primary leading-none">{value}</p>
        <p className="text-xs text-secondary">{label}</p>
      </div>
    </div>
  );
}
