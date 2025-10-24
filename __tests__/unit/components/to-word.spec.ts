import { describe, expect, it } from 'vitest';
import { compare } from '@/components/to-word';

describe('compare', () => {
  it('returns true for matching strings', () => {
    expect(compare({ answer: 'anything', input: 'anything' })).toBe(true);
  });

  it('returns false for non-matching strings', () => {
    expect(compare({ answer: 'anything', input: 'something' })).toBe(false);
  });

  it('is case insensitive', () => {
    expect(compare({ answer: 'Anything', input: 'anything' })).toBe(true);
    expect(compare({ answer: 'ANYTHING', input: 'anything' })).toBe(true);
  });

  it('trims whitespace', () => {
    expect(compare({ answer: '  anything  ', input: 'anything' })).toBe(true);
    expect(compare({ answer: 'anything', input: '  anything  ' })).toBe(true);
  });

  it('handles optional parentheses', () => {
    expect(compare({ answer: 'a lot of (sth)', input: 'a lot of' })).toBe(true);
    expect(compare({ answer: 'a lot of (sth)', input: 'a lot of sth' })).toBe(false);
    expect(compare({ answer: 'a lot of (sth)', input: 'a lot of (sth)' })).toBe(true);
    expect(compare({ answer: 'a lot of (sth)', input: 'a lot of something' })).toBe(false);
  });
});
