import { http, HttpResponse } from 'msw';
import type { JsonBodyType } from 'msw';
import type { Statistics } from '@/server/statistics/dtos/statistics.dto';
import type { userVocabularyItemWithRelationsDto } from '@/server/user-vocabulary/dtos/user-vocabulary-item-with-relations.dto';
import type { z } from '@hono/zod-openapi';

type StatisticsResponse = {
  success: true;
  data: Statistics;
};

type UserVocabularyItemWithRelations = z.infer<typeof userVocabularyItemWithRelationsDto>;

type PaginatedResponse<T> = {
  success: true;
  data: T[];
  pageInfo: { total: number; count: number; nextCursor?: string };
};

export const api = {
  statistics: {
    mock: (fn: (searchParams: URLSearchParams) => HttpResponse<JsonBodyType>) => {
      return http.get('/api/v1/users/me/statistics', ({ request }) => {
        return fn(new URL(request.url).searchParams);
      });
    },
    ok: (data: Statistics) =>
      api.statistics.mock(() =>
        HttpResponse.json<StatisticsResponse>({
          success: true,
          data,
        }),
      ),
  },
  vocabularyListDiscoverItems: {
    ok: (userVocabularyListId: string, items: UserVocabularyItemWithRelations[]) => {
      return http.get(`/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/items`, () => {
        return HttpResponse.json<PaginatedResponse<UserVocabularyItemWithRelations>>({
          success: true,
          data: items,
          pageInfo: { total: items.length, count: items.length },
        });
      });
    },
  },
  discoverUserVocabularyItem: {
    mock: (userVocabularyListId: string, fn: (userVocabularyItemId: string) => HttpResponse<JsonBodyType>) => {
      return http.post(
        `/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/items/:userVocabularyItemId/discover`,
        ({ params }) => fn(params.userVocabularyItemId as string),
      );
    },
  },
};
