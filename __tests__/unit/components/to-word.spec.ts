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

  it('handles several entries with parentheses', () => {
    expect(compare({ answer: 'take care of (sth/smb)', input: 'take care of (sth)' })).toBe(true);
    expect(compare({ answer: 'take care of (sth/smb)', input: 'take care of (smb)' })).toBe(true);
    expect(compare({ answer: 'take care of (sth/smb)', input: 'take care of (sth/smb)' })).toBe(true);
    expect(compare({ answer: 'take care of (sth/smb)', input: 'take care of (any)' })).toBe(false);
  });

  it('handles several parentheses', () => {
    expect(compare({ answer: 'make (sth/smb) up (sth)', input: 'make (smb) up (sth)' })).toBe(true);
    expect(compare({ answer: 'make (sth/smb) up (sth)', input: 'make (sth) up (sth)' })).toBe(true);
    expect(compare({ answer: 'make (sth/smb) up (sth)', input: 'make (sth/smb) up (sth)' })).toBe(true);
    expect(compare({ answer: 'make (sth/smb) up (sth)', input: 'make (any) up (sth)' })).toBe(false);
    expect(compare({ answer: 'make (sth/smb) up (sth)', input: 'make (smb) up (any)' })).toBe(false);
  });

  it('escapes special regex characters', () => {
    expect(compare({ answer: 'find (sth).*', input: 'find (sth).*' })).toBe(true);
    expect(compare({ answer: 'find (sth).*', input: 'find (sth)X*' })).toBe(false);
  });
});
