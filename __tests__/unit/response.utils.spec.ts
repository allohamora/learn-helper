import { describe, it, expect } from 'vitest';
import { toSuccessResponse, toErrorResponse, toPaginatedResponse } from '@/server/utils/response.utils';

describe('response.utils', () => {
  describe('toSuccessResponse', () => {
    it('returns a success tuple with the given data and status', () => {
      expect(toSuccessResponse({ status: 200, data: { id: 1 } })).toEqual([{ success: true, data: { id: 1 } }, 200]);
    });
  });

  describe('toErrorResponse', () => {
    it('returns an error tuple with the given messages and status', () => {
      expect(toErrorResponse({ status: 404, messages: ['Not found'] })).toEqual([
        { success: false, error: { messages: ['Not found'], code: undefined, details: undefined } },
        404,
      ]);
    });

    it('includes code and details when provided', () => {
      expect(
        toErrorResponse({ status: 400, messages: ['Bad request'], code: 'BAD_REQUEST', details: { field: 'name' } }),
      ).toEqual([
        { success: false, error: { messages: ['Bad request'], code: 'BAD_REQUEST', details: { field: 'name' } } },
        400,
      ]);
    });
  });

  describe('toPaginatedResponse', () => {
    it('returns a paginated tuple with data and pageInfo', () => {
      const pageInfo = { total: 1, count: 1 };

      expect(toPaginatedResponse({ status: 200, data: [{ id: 1 }], pageInfo })).toEqual([
        { success: true, data: [{ id: 1 }], pageInfo },
        200,
      ]);
    });
  });
});
