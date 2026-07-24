import { describe, expect, it } from 'vitest';
import { nanoDollarsToDollars } from '@/utils/currency';

describe('nanoDollarsToDollars', () => {
  it('converts nano-dollars to dollars', () => {
    expect(nanoDollarsToDollars(1_500_000_000)).toBe(1.5);
  });
});
