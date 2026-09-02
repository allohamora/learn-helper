import { describe, it, expect } from 'vitest';
import { Exception } from '@/server/utils/exception.utils';

describe('exception.utils', () => {
  describe('cause', () => {
    it('threads cause through to the native Error.cause', () => {
      const cause = new Error('original failure');

      const exception = Exception.badRequest('msg', { cause });

      expect(exception.cause).toBe(cause);
    });

    it('does not leak cause into payload/details', () => {
      const cause = new Error('original failure');

      const exception = Exception.badRequest('msg', { cause });

      expect(exception.payload).toBeUndefined();
      expect(exception.toHttpResponse()[0].error.details).toBeUndefined();
    });

    it('keeps other options in payload/details alongside cause', () => {
      const cause = new Error('original failure');

      const exception = Exception.badRequest('msg', { cause, extra: 1 });

      expect(exception.payload).toEqual({ extra: 1 });
      expect(exception.toHttpResponse()[0].error.details).toEqual({ extra: 1 });
    });
  });

  describe('internalServer', () => {
    it('uses the given message as-is, instead of a hardcoded generic message', () => {
      const exception = Exception.internalServer('custom message');

      expect(exception.message).toBe('custom message');
      expect(exception.toHttpResponse()[0].error.messages).toEqual(['custom message']);
    });
  });
});
