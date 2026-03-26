import { describe, it, expect } from 'vitest';
import { cn, formatCount, formatDate, formatRelativeDate, statusVariant } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('resolves tailwind conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles falsy values', () => {
    expect(cn('a', false, null, 'b')).toBe('a b');
  });
});

describe('formatDate', () => {
  it('formats ISO string', () => {
    const result = formatDate('2026-01-15T12:00:00Z');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });
});

describe('formatRelativeDate', () => {
  it('returns "just now" for < 60s', () => {
    const now = new Date().toISOString();
    expect(formatRelativeDate(now)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeDate(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000).toISOString();
    expect(formatRelativeDate(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(formatRelativeDate(twoDaysAgo)).toBe('2d ago');
  });

  it('falls back to formatDate for 7+ days', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const result = formatRelativeDate(tenDaysAgo);
    // Should return a formatted date string, not relative
    expect(result).not.toContain('ago');
    expect(result).not.toBe('just now');
  });
});

describe('formatCount', () => {
  it('returns plain number below 1000', () => {
    expect(formatCount(42)).toBe('42');
    expect(formatCount(999)).toBe('999');
  });

  it('formats thousands', () => {
    expect(formatCount(1500)).toBe('1.5K');
  });

  it('formats millions', () => {
    expect(formatCount(2_500_000)).toBe('2.5M');
  });
});

describe('statusVariant', () => {
  it('maps ongoing to success', () => {
    expect(statusVariant('ongoing')).toBe('success');
  });

  it('maps completed to info', () => {
    expect(statusVariant('completed')).toBe('info');
  });

  it('maps hiatus to warning', () => {
    expect(statusVariant('hiatus')).toBe('warning');
  });

  it('maps dropped to accent', () => {
    expect(statusVariant('dropped')).toBe('accent');
  });

  it('defaults unknown status', () => {
    expect(statusVariant('unknown')).toBe('default');
  });
});
