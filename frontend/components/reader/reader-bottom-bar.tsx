'use client';

import {
  CaretLeftIcon,
  CaretRightIcon,
  ListBulletsIcon,
  ChatCircleIcon,
  GearSixIcon,
} from '@phosphor-icons/react';

type MobilePanel = 'chapters' | 'comments' | 'settings' | null;

interface Props {
  hasPrev: boolean;
  hasNext: boolean;
  hidden: boolean;
  activePanel: MobilePanel;
  onPrev: () => void;
  onNext: () => void;
  onTogglePanel: (panel: MobilePanel) => void;
}

/** Fixed bottom navigation bar for mobile (<768px). */
export function ReaderBottomBar({
  hasPrev,
  hasNext,
  hidden,
  activePanel,
  onPrev,
  onNext,
  onTogglePanel,
}: Props) {
  return (
    <div
      data-reader-control
      className={`absolute bottom-0 left-0 right-0 z-40 h-14 bg-surface/95 backdrop-blur-sm border-t border-default/50 flex items-center justify-around px-2 md:hidden transition-transform duration-300 ${
        hidden ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <BarButton
        icon={<CaretLeftIcon size={20} />}
        label="Prev"
        disabled={!hasPrev}
        onClick={onPrev}
      />
      <BarButton
        icon={<ListBulletsIcon size={20} />}
        label="Chapters"
        active={activePanel === 'chapters'}
        onClick={() => onTogglePanel(activePanel === 'chapters' ? null : 'chapters')}
      />
      <BarButton
        icon={<ChatCircleIcon size={20} />}
        label="Comments"
        active={activePanel === 'comments'}
        onClick={() => onTogglePanel(activePanel === 'comments' ? null : 'comments')}
      />
      <BarButton
        icon={<GearSixIcon size={20} />}
        label="Settings"
        active={activePanel === 'settings'}
        onClick={() => onTogglePanel(activePanel === 'settings' ? null : 'settings')}
      />
      <BarButton
        icon={<CaretRightIcon size={20} />}
        label="Next"
        disabled={!hasNext}
        onClick={onNext}
      />
    </div>
  );
}

function BarButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[52px] ${
        disabled
          ? 'opacity-30 cursor-not-allowed'
          : active
            ? 'text-accent'
            : 'text-secondary active:text-primary'
      }`}
    >
      {icon}
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
}
