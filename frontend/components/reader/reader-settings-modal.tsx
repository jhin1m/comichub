'use client';

import { useState } from 'react';
import { X, Layout, ImageIcon, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DisplayMode = 'single' | 'double' | 'longstrip';
export type ProgressPosition = 'top' | 'bottom' | 'left' | 'right' | 'none';

interface Props {
  open: boolean;
  onClose: () => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  stripMargin: number;
  onStripMarginChange: (margin: number) => void;
  progressPosition: ProgressPosition;
  onProgressPositionChange: (pos: ProgressPosition) => void;
}

type Tab = 'layout' | 'image' | 'shortcuts';

const tabs: { id: Tab; icon: typeof Layout; label: string }[] = [
  { id: 'layout', icon: Layout, label: 'Layout' },
  { id: 'image', icon: ImageIcon, label: 'Image' },
  { id: 'shortcuts', icon: Keyboard, label: 'Shortcuts' },
];

export function ReaderSettingsModal({
  open,
  onClose,
  displayMode,
  onDisplayModeChange,
  stripMargin,
  onStripMarginChange,
  progressPosition,
  onProgressPositionChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('layout');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-surface border border-default rounded-lg w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-default">
          <h2 className="font-rajdhani font-bold text-lg text-primary">Advanced Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-secondary hover:text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-default">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-label={label}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors border-b-2',
                activeTab === id
                  ? 'text-accent border-accent'
                  : 'text-secondary hover:text-primary border-transparent',
              )}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {activeTab === 'layout' && (
            <LayoutTab
              displayMode={displayMode}
              onDisplayModeChange={onDisplayModeChange}
              stripMargin={stripMargin}
              onStripMarginChange={onStripMarginChange}
              progressPosition={progressPosition}
              onProgressPositionChange={onProgressPositionChange}
            />
          )}
          {activeTab === 'image' && (
            <p className="text-secondary text-sm text-center py-8">Image settings coming soon.</p>
          )}
          {activeTab === 'shortcuts' && (
            <p className="text-secondary text-sm text-center py-8">Keyboard shortcuts coming soon.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LayoutTab({
  displayMode,
  onDisplayModeChange,
  stripMargin,
  onStripMarginChange,
  progressPosition,
  onProgressPositionChange,
}: Pick<Props, 'displayMode' | 'onDisplayModeChange' | 'stripMargin' | 'onStripMarginChange' | 'progressPosition' | 'onProgressPositionChange'>) {
  const displayOptions: { value: DisplayMode; label: string }[] = [
    { value: 'single', label: 'Single Page' },
    { value: 'double', label: 'Double Page' },
    { value: 'longstrip', label: 'Long Strip' },
  ];

  const positionOptions: { value: ProgressPosition; label: string }[] = [
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'none', label: 'None' },
  ];

  return (
    <>
      {/* Display mode */}
      <SettingRow label="Page Display Style">
        <div className="flex gap-1.5">
          {displayOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onDisplayModeChange(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                displayMode === opt.value
                  ? 'bg-accent text-white'
                  : 'bg-elevated text-secondary hover:text-primary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SettingRow>

      {/* Strip margin */}
      <SettingRow label="Strip Margin">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={50}
            value={stripMargin}
            onChange={(e) => onStripMarginChange(Math.max(0, Math.min(50, Number(e.target.value))))}
            className="w-16 h-8 bg-elevated border border-default rounded-md px-2 text-sm text-primary text-center focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={() => onStripMarginChange(0)}
            className="text-xs text-secondary hover:text-primary transition-colors"
          >
            Reset
          </button>
        </div>
      </SettingRow>

      {/* Progress position */}
      <SettingRow label="Progress Bar Position">
        <div className="flex gap-1.5 flex-wrap">
          {positionOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onProgressPositionChange(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                progressPosition === opt.value
                  ? 'bg-accent text-white'
                  : 'bg-elevated text-secondary hover:text-primary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SettingRow>
    </>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-primary font-medium">{label}</label>
      {children}
    </div>
  );
}
