import { describe, it, expect } from 'vitest';
import { escapeLikePattern } from '@/server/db/db.utils';

describe('db.utils', () => {
  describe('escapeLikePattern', () => {
    it('returns the value unchanged when it has no metacharacters', () => {
      expect(escapeLikePattern('hello')).toBe('hello');
    });

    it('escapes %', () => {
      expect(escapeLikePattern('100%')).toBe('100\\%');
    });

    it('escapes _', () => {
      expect(escapeLikePattern('foo_bar')).toBe('foo\\_bar');
    });

    it('escapes \\', () => {
      expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
    });

    it('escapes multiple metacharacters together', () => {
      expect(escapeLikePattern('50%_off\\sale')).toBe('50\\%\\_off\\\\sale');
    });

    it('returns an empty string unchanged', () => {
      expect(escapeLikePattern('')).toBe('');
    });
  });
});
