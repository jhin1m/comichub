'use client';

import { UsersThree } from '@phosphor-icons/react';
import type { TaxonomyItem } from '@/types/manga.types';

interface Props {
  groups: TaxonomyItem[];
  selectedGroupId: number | null;
  onSelect: (groupId: number | null) => void;
}

/** Pill selector for switching between scanlation groups. Hidden when ≤1 group. */
export function GroupPillSelector({ groups, selectedGroupId, onSelect }: Props) {
  if (groups.length <= 1) return null;

  return (
    <div className="px-4 py-3 border-t border-default">
      <div className="font-rajdhani text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
        Scanlation Group
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {groups.map((group) => {
          const isActive = selectedGroupId === group.id;
          return (
            <button
              key={group.id}
              onClick={() => onSelect(group.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border whitespace-nowrap transition-colors min-h-9 ${
                isActive
                  ? 'bg-accent/12 text-accent border-accent/35 font-semibold'
                  : 'bg-elevated text-secondary border-default hover:bg-hover hover:text-primary hover:border-[#3a3a3a]'
              }`}
            >
              <UsersThree size={14} weight={isActive ? 'fill' : 'regular'} className={isActive ? 'opacity-100' : 'opacity-70'} />
              {group.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
