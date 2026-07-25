import { describe, expect, it } from 'vitest';
import { formatDollars, nanoDollarsToDollars } from '@/utils/currency';

describe('nanoDollarsToDollars', () => {
  it('converts nano-dollars to dollars', () => {
    expect(nanoDollarsToDollars(1_500_000_000)).toBe(1.5);
  });
});

describe('formatDollars', () => {
  it('pads a single decimal digit to two', () => {
    expect(formatDollars(3.5)).toBe('$3.50');
  });

  it('rounds long floating-point tails to two decimals', () => {
    expect(formatDollars(0.000001234)).toBe('$0.00');
  });

  it('formats whole numbers with two decimal places', () => {
    expect(formatDollars(2)).toBe('$2.00');
  });

  it('adds thousands separators for large values', () => {
    expect(formatDollars(1234.5)).toBe('$1,234.50');
  });
});
