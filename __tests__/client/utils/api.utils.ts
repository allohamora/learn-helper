import { http, HttpResponse } from 'msw';
import type { JsonBodyType } from 'msw';
import type { Statistics } from '@/server/statistics/dtos/statistics.dto';
import type { userVocabularyItemWithRelationsDto } from '@/server/user-vocabulary/dtos/user-vocabulary-item-with-relations.dto';
import type { personalVocabularyItemSearchResultDto } from '@/server/user-vocabulary/dtos/personal-vocabulary-item-search-result.dto';
import type { z } from '@hono/zod-openapi';

type StatisticsResponse = {
  success: true;
  data: Statistics;
};

type UserVocabularyItemWithRelations = z.infer<typeof userVocabularyItemWithRelationsDto>;
type PersonalVocabularyItemSearchResult = z.infer<typeof personalVocabularyItemSearchResultDto>;

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
    ok: (userVocabularyListId: string, vocabularyItems: UserVocabularyItemWithRelations[]) => {
      return http.get(`/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/items`, () => {
        return HttpResponse.json<PaginatedResponse<UserVocabularyItemWithRelations>>({
          success: true,
          data: vocabularyItems,
          pageInfo: { total: vocabularyItems.length, count: vocabularyItems.length },
        });
      });
    },
  },
  discoverUserVocabularyItem: {
    mock: (
      userVocabularyListId: string,
      responseFactory: (userVocabularyItemId: string) => HttpResponse<JsonBodyType>,
    ) => {
      return http.post(
        `/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/items/:userVocabularyItemId/discover`,
        ({ params: routeParams }) => responseFactory(routeParams.userVocabularyItemId as string),
      );
    },
  },
  personalVocabularyItemSearch: {
    mock: (userVocabularyListId: string, fn: (searchParams: URLSearchParams) => HttpResponse<JsonBodyType>) => {
      return http.get(`/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/search`, ({ request }) => {
        return fn(new URL(request.url).searchParams);
      });
    },
    ok: (userVocabularyListId: string, results: PersonalVocabularyItemSearchResult[]) =>
      api.personalVocabularyItemSearch.mock(userVocabularyListId, () =>
        HttpResponse.json<PaginatedResponse<PersonalVocabularyItemSearchResult>>({
          success: true,
          data: results,
          pageInfo: { total: results.length, count: results.length },
        }),
      ),
  },
  addVocabularyItemToPersonalList: {
    mock: (userVocabularyListId: string, responseFactory: (vocabularyItemId: string) => HttpResponse<JsonBodyType>) => {
      return http.post(`/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/items`, async ({ request }) => {
        const body = (await request.json()) as { vocabularyItemId: string };

        return responseFactory(body.vocabularyItemId);
      });
    },
  },
  removeVocabularyItemFromPersonalList: {
    mock: (
      userVocabularyListId: string,
      responseFactory: (userVocabularyItemId: string) => HttpResponse<JsonBodyType>,
    ) => {
      return http.delete(
        `/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/items/:userVocabularyItemId`,
        ({ params: routeParams }) => responseFactory(routeParams.userVocabularyItemId as string),
      );
    },
  },
  generateVocabularyItem: {
    mock: (
      userVocabularyListId: string,
      responseFactory: (value: string, context: string | undefined) => HttpResponse<JsonBodyType>,
    ) => {
      return http.post(
        `/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/items/generate`,
        async ({ request }) => {
          const body = (await request.json()) as { value: string; context?: string };

          return responseFactory(body.value, body.context);
        },
      );
    },
  },
};
