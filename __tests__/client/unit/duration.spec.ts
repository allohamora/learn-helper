import { describe, expect, it } from 'vitest';
import { formatDuration } from '@/utils/duration';

describe('formatDuration', () => {
  it('formats durations at seconds, minutes, and hours precision', () => {
    expect(formatDuration(5_900)).toBe('5s');
    expect(formatDuration(125_000)).toBe('2m 5s');
    expect(formatDuration(3_661_000)).toBe('1h 1m');
    expect(formatDuration(-1)).toBe('0s');
  });
});
