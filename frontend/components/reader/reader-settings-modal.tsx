'use client';

import { useState } from 'react';
import type React from 'react';
import { XIcon, LayoutIcon, ImageIcon, KeyboardIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type {
  ReaderSettings,
  DisplayMode,
  ProgressPosition,
  FitMode,
  ReadingDirection,
  ColorFilter,
} from '@/hooks/use-reader-settings';

interface Props {
  open: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdate: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
}

type Tab = 'layout' | 'image' | 'shortcuts';

const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: 'layout', icon: LayoutIcon, label: 'Layout' },
  { id: 'image', icon: ImageIcon, label: 'Image' },
  { id: 'shortcuts', icon: KeyboardIcon, label: 'Shortcuts' },
];

export function ReaderSettingsModal({ open, onClose, settings, onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('layout');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-surface border border-default rounded-lg w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-default">
          <h2 className="font-rajdhani font-bold text-lg text-primary">Reader Settings</h2>
          <button onClick={onClose} aria-label="Close settings" className="text-secondary hover:text-primary transition-colors">
            <XIcon size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-default">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors border-b-2',
                activeTab === id ? 'text-accent border-accent' : 'text-secondary hover:text-primary border-transparent',
              )}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {activeTab === 'layout' && <LayoutTab settings={settings} onUpdate={onUpdate} />}
          {activeTab === 'image' && <ImageTab settings={settings} onUpdate={onUpdate} />}
          {activeTab === 'shortcuts' && <ShortcutsTab />}
        </div>
      </div>
    </div>
  );
}

/* ─── Layout Tab ────────────────────────────────────────── */

function LayoutTab({ settings, onUpdate }: Pick<Props, 'settings' | 'onUpdate'>) {
  const displayOptions: { value: DisplayMode; label: string }[] = [
    { value: 'single', label: 'Single' },
    { value: 'double', label: 'Double' },
    { value: 'longstrip', label: 'Long Strip' },
  ];
  const fitOptions: { value: FitMode; label: string }[] = [
    { value: 'width', label: 'Fit Width' },
    { value: 'height', label: 'Fit Height' },
    { value: 'original', label: 'Original' },
  ];
  const dirOptions: { value: ReadingDirection; label: string }[] = [
    { value: 'ltr', label: 'LTR →' },
    { value: 'rtl', label: 'RTL ←' },
  ];
  const posOptions: { value: ProgressPosition; label: string }[] = [
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'none', label: 'None' },
  ];

  return (
    <>
      <SettingRow label="Display Mode">
        <PillGroup options={displayOptions} value={settings.displayMode} onChange={(v) => onUpdate('displayMode', v)} />
      </SettingRow>
      <SettingRow label="Fit Mode">
        <PillGroup options={fitOptions} value={settings.fitMode} onChange={(v) => onUpdate('fitMode', v)} />
      </SettingRow>
      <SettingRow label="Reading Direction">
        <PillGroup options={dirOptions} value={settings.readingDirection} onChange={(v) => onUpdate('readingDirection', v)} />
      </SettingRow>
      <SettingRow label="Strip Margin">
        <div className="flex items-center gap-3">
          <input
            type="range" min={0} max={50} value={settings.stripMargin}
            onChange={(e) => onUpdate('stripMargin', Number(e.target.value))}
            className="flex-1 accent-accent h-1"
          />
          <span className="text-xs text-secondary min-w-[32px] text-right tabular-nums">{settings.stripMargin}px</span>
          <button onClick={() => onUpdate('stripMargin', 0)} className="text-xs text-muted hover:text-primary transition-colors">Reset</button>
        </div>
      </SettingRow>
      <SettingRow label="Progress Bar">
        <PillGroup options={posOptions} value={settings.progressPosition} onChange={(v) => onUpdate('progressPosition', v)} />
      </SettingRow>
    </>
  );
}

/* ─── Image Tab ─────────────────────────────────────────── */

function ImageTab({ settings, onUpdate }: Pick<Props, 'settings' | 'onUpdate'>) {
  const filterOptions: { value: ColorFilter; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'sepia', label: 'Sepia' },
    { value: 'warm', label: 'Warm' },
    { value: 'cool', label: 'Cool' },
  ];

  return (
    <>
      <SettingRow label="Color Filter">
        <PillGroup options={filterOptions} value={settings.colorFilter} onChange={(v) => onUpdate('colorFilter', v)} />
      </SettingRow>
      <SliderRow label="Brightness" value={settings.brightness} min={50} max={150} unit="%" onChange={(v) => onUpdate('brightness', v)} onReset={() => onUpdate('brightness', 100)} />
      <SliderRow label="Contrast" value={settings.contrast} min={50} max={150} unit="%" onChange={(v) => onUpdate('contrast', v)} onReset={() => onUpdate('contrast', 100)} />
      <SliderRow label="Saturation" value={settings.saturation} min={0} max={200} unit="%" onChange={(v) => onUpdate('saturation', v)} onReset={() => onUpdate('saturation', 100)} />
      <p className="text-xs text-muted pt-1">Filters are applied via CSS and saved automatically.</p>
    </>
  );
}

/* ─── Shortcuts Tab ─────────────────────────────────────── */

const shortcuts: [string, string][] = [
  ['←', 'Previous chapter'],
  ['→', 'Next chapter'],
  ['↑', 'Scroll up / Prev page'],
  ['↓ / Space', 'Scroll down / Next page'],
  ['F', 'Toggle fullscreen'],
  ['Esc', 'Exit / Close'],
];

function ShortcutsTab() {
  return (
    <div className="space-y-1">
      {shortcuts.map(([key, action]) => (
        <div key={key} className="flex items-center justify-between py-1.5">
          <span className="text-sm text-secondary">{action}</span>
          <kbd className="text-xs bg-elevated border border-default rounded px-2 py-0.5 font-mono text-primary">{key}</kbd>
        </div>
      ))}
    </div>
  );
}

/* ─── Shared UI ─────────────────────────────────────────── */

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-primary font-medium">{label}</label>
      {children}
    </div>
  );
}

function PillGroup<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            value === opt.value ? 'bg-accent text-white' : 'bg-elevated text-secondary hover:text-primary',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SliderRow({ label, value, min, max, unit, onChange, onReset }: {
  label: string; value: number; min: number; max: number; unit: string;
  onChange: (v: number) => void; onReset: () => void;
}) {
  return (
    <SettingRow label={label}>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-accent h-1" />
        <span className="text-xs text-secondary min-w-[40px] text-right tabular-nums">{value}{unit}</span>
        <button onClick={onReset} className="text-xs text-muted hover:text-primary transition-colors">Reset</button>
      </div>
    </SettingRow>
  );
}
