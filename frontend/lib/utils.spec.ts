import { describe, it, expect } from 'vitest';
import { cn, formatCount, formatDate, formatRelativeDate, formatRelativeDateCompact, statusVariant } from './utils';

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

  it('uses singular for 1 minute', () => {
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    expect(formatRelativeDate(oneMinAgo)).toBe('1 minute ago');
  });

  it('uses plural for multiple minutes', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeDate(fiveMinAgo)).toBe('5 minutes ago');
  });

  it('uses singular for 1 hour', () => {
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    expect(formatRelativeDate(oneHourAgo)).toBe('1 hour ago');
  });

  it('uses plural for multiple hours', () => {
    const sixHoursAgo = new Date(Date.now() - 6 * 3_600_000).toISOString();
    expect(formatRelativeDate(sixHoursAgo)).toBe('6 hours ago');
  });

  it('uses singular for 1 day', () => {
    const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
    expect(formatRelativeDate(oneDayAgo)).toBe('1 day ago');
  });

  it('uses plural for multiple days', () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000).toISOString();
    expect(formatRelativeDate(fourDaysAgo)).toBe('4 days ago');

    const twentyOneDaysAgo = new Date(Date.now() - 21 * 86_400_000).toISOString();
    expect(formatRelativeDate(twentyOneDaysAgo)).toBe('21 days ago');
  });

  it('uses singular for 1 month', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    expect(formatRelativeDate(thirtyDaysAgo)).toBe('1 month ago');
  });

  it('uses plural for multiple months', () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();
    expect(formatRelativeDate(sixtyDaysAgo)).toBe('2 months ago');
  });

  it('uses singular for 1 year', () => {
    const oneYearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString();
    expect(formatRelativeDate(oneYearAgo)).toBe('1 year ago');
  });

  it('uses plural for multiple years', () => {
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 86_400_000).toISOString();
    expect(formatRelativeDate(twoYearsAgo)).toBe('2 years ago');
  });
});

describe('formatRelativeDateCompact', () => {
  it('returns "now" for < 60s', () => {
    const now = new Date().toISOString();
    expect(formatRelativeDateCompact(now)).toBe('now');
  });

  it('returns minutes with min suffix', () => {
    const fortyMinAgo = new Date(Date.now() - 40 * 60_000).toISOString();
    expect(formatRelativeDateCompact(fortyMinAgo)).toBe('40min');
  });

  it('returns hours with h suffix', () => {
    const sixHoursAgo = new Date(Date.now() - 6 * 3_600_000).toISOString();
    expect(formatRelativeDateCompact(sixHoursAgo)).toBe('6h');
  });

  it('returns days with d suffix for 1-29 days', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(formatRelativeDateCompact(twoDaysAgo)).toBe('2d');

    const twentyOneDaysAgo = new Date(Date.now() - 21 * 86_400_000).toISOString();
    expect(formatRelativeDateCompact(twentyOneDaysAgo)).toBe('21d');
  });

  it('returns clean months when no residual days (multiple of 30)', () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();
    expect(formatRelativeDateCompact(sixtyDaysAgo)).toBe('2mo');
  });

  it('returns composite months + days when residual days > 0', () => {
    // 71 days = 2 months (60 days) + 11 residual days
    const seventyOneDaysAgo = new Date(Date.now() - 71 * 86_400_000).toISOString();
    expect(formatRelativeDateCompact(seventyOneDaysAgo)).toBe('2mo, 11d');
  });

  it('returns clean years when no residual months', () => {
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 86_400_000).toISOString();
    expect(formatRelativeDateCompact(twoYearsAgo)).toBe('2y');
  });

  it('returns composite years + months when residual months > 0', () => {
    // 400 days = 1 year (365 days) + 35 residual days = 1 month
    const fourHundredDaysAgo = new Date(Date.now() - 400 * 86_400_000).toISOString();
    expect(formatRelativeDateCompact(fourHundredDaysAgo)).toBe('1y, 1mo');
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
