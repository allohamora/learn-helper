import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { apiRequest, apiPaginationRequest, appClient } from '@/services/api';
import { mockServer } from '../../setup-unit-context';

describe('services/api', () => {
  describe('apiRequest', () => {
    it('resolves to the unwrapped data on success', async () => {
      mockServer.addHandlers(
        http.get('/api/v1/users/me/statistics', () =>
          HttpResponse.json({ success: true, data: { totalDiscoveredItems: 3 } }),
        ),
      );

      const result = await apiRequest(
        () => appClient.api.v1.users.me.statistics.$get({ query: {} }),
        'Failed to load statistics',
      );

      expect(result).toEqual({ totalDiscoveredItems: 3 });
    });

    it('rejects with the server error message on failure', async () => {
      mockServer.addHandlers(
        http.get('/api/v1/users/me/statistics', () =>
          HttpResponse.json(
            { success: false, error: { messages: ['Invalid timezone'], code: 'BAD_REQUEST' } },
            { status: 400 },
          ),
        ),
      );

      await expect(
        apiRequest(() => appClient.api.v1.users.me.statistics.$get({ query: {} }), 'Failed to load statistics'),
      ).rejects.toThrow('Invalid timezone');
    });

    it('joins multiple server error messages', async () => {
      mockServer.addHandlers(
        http.get('/api/v1/users/me/statistics', () =>
          HttpResponse.json(
            { success: false, error: { messages: ['First problem', 'Second problem'], code: 'BAD_REQUEST' } },
            { status: 400 },
          ),
        ),
      );

      await expect(
        apiRequest(() => appClient.api.v1.users.me.statistics.$get({ query: {} }), 'Failed to load statistics'),
      ).rejects.toThrow('First problem, Second problem');
    });

    it('rejects with the fallback message when the body has no error messages', async () => {
      mockServer.addHandlers(
        http.get('/api/v1/users/me/statistics', () => HttpResponse.json({ success: false }, { status: 500 })),
      );

      await expect(
        apiRequest(() => appClient.api.v1.users.me.statistics.$get({ query: {} }), 'Failed to load statistics'),
      ).rejects.toThrow('Failed to load statistics');
    });

    it('rejects with the default fallback message when none is provided', async () => {
      mockServer.addHandlers(
        http.get('/api/v1/users/me/statistics', () => HttpResponse.json({ success: false }, { status: 500 })),
      );

      await expect(apiRequest(() => appClient.api.v1.users.me.statistics.$get({ query: {} }))).rejects.toThrow(
        'Something went wrong',
      );
    });
  });

  describe('apiPaginationRequest', () => {
    it('resolves to the full paginated envelope on success', async () => {
      mockServer.addHandlers(
        http.get('/api/v1/users/me/vocabulary-lists/personal/search', () =>
          HttpResponse.json({
            success: true,
            data: [{ id: 'item-1' }],
            pageInfo: { total: 1, count: 1 },
          }),
        ),
      );

      const result = await apiPaginationRequest(
        () => appClient.api.v1.users.me['vocabulary-lists'].personal.search.$get({ query: { value: 'run' } }),
        'Failed to search items',
      );

      expect(result).toEqual({
        success: true,
        data: [{ id: 'item-1' }],
        pageInfo: { total: 1, count: 1 },
      });
    });

    it('rejects with the server error message on failure', async () => {
      mockServer.addHandlers(
        http.get('/api/v1/users/me/vocabulary-lists/personal/search', () =>
          HttpResponse.json(
            { success: false, error: { messages: ['Search failed'], code: 'BAD_REQUEST' } },
            { status: 400 },
          ),
        ),
      );

      await expect(
        apiPaginationRequest(
          () => appClient.api.v1.users.me['vocabulary-lists'].personal.search.$get({ query: { value: 'run' } }),
          'Failed to search items',
        ),
      ).rejects.toThrow('Search failed');
    });
  });
});
