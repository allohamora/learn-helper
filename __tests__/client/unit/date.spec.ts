import { describe, expect, it, vi } from 'vitest';
import { getBrowserTimezone, toShortDate } from '@/utils/date';

describe('toShortDate', () => {
  it('removes the year from a valid date', () => {
    expect(toShortDate('2026-07-24')).toBe('07-24');
  });

  it('throws for an invalid date', () => {
    expect(() => toShortDate('invalid')).toThrow('Invalid statistics date');
  });
});

describe('getBrowserTimezone', () => {
  it('returns the browser timezone', () => {
    const resolvedOptionsSpy = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Europe/Kyiv',
    } as Intl.ResolvedDateTimeFormatOptions);

    expect(getBrowserTimezone()).toBe('Europe/Kyiv');
    resolvedOptionsSpy.mockRestore();
  });

  it('falls back to UTC when the browser timezone is unavailable', () => {
    const resolvedOptionsSpy = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: '',
    } as Intl.ResolvedDateTimeFormatOptions);

    expect(getBrowserTimezone()).toBe('UTC');
    resolvedOptionsSpy.mockRestore();
  });
});
