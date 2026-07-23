import { describe, expect, it } from 'vitest';
import { compare } from '@/components/to-vocabulary-item';

describe('compare', () => {
  it('matches case-insensitively and trims whitespace', () => {
    expect(compare({ answer: 'Anything', input: '  anything  ' })).toBe(true);
  });

  it('rejects different strings', () => {
    expect(compare({ answer: 'anything', input: 'something' })).toBe(false);
  });

  it('handles optional parentheses', () => {
    expect(compare({ answer: 'a lot of (sth)', input: 'a lot of' })).toBe(true);
    expect(compare({ answer: 'a lot of (sth)', input: 'a lot of (sth)' })).toBe(true);
    expect(compare({ answer: 'a lot of (sth)', input: 'a lot of sth' })).toBe(false);
  });

  it('handles alternatives and multiple parenthetical groups', () => {
    expect(compare({ answer: 'make (sth/smb) up (sth)', input: 'make (smb) up (sth)' })).toBe(true);
    expect(compare({ answer: 'make (sth/smb) up (sth)', input: 'make (any) up (sth)' })).toBe(false);
  });

  it('escapes regular expression characters', () => {
    expect(compare({ answer: 'find (sth).*', input: 'find (sth).*' })).toBe(true);
    expect(compare({ answer: 'find (sth).*', input: 'find (sth)X*' })).toBe(false);
  });
});
