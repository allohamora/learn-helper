import { http, HttpResponse } from 'msw';
import type { JsonBodyType } from 'msw';
import type { Statistics } from '@/server/statistics/dtos/statistics.dto';
import type { userVocabularyItemWithRelationsDto } from '@/server/user-vocabulary/dtos/user-vocabulary-item-with-relations.dto';
import type { personalVocabularyItemSearchResultDto } from '@/server/user-vocabulary/dtos/personal-vocabulary-item-search-result.dto';
import type { readingDto } from '@/server/reading/dtos/reading.dto';
import type { z } from '@hono/zod-openapi';

type StatisticsResponse = {
  success: true;
  data: Statistics;
};

type UserVocabularyItemWithRelations = z.infer<typeof userVocabularyItemWithRelationsDto>;
type PersonalVocabularyItemSearchResult = z.infer<typeof personalVocabularyItemSearchResultDto>;
type Reading = z.infer<typeof readingDto>;

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
    mock: (fn: (searchParams: URLSearchParams) => HttpResponse<JsonBodyType>) => {
      return http.get(`/api/v1/users/me/vocabulary-lists/personal/search`, ({ request }) => {
        return fn(new URL(request.url).searchParams);
      });
    },
    ok: (results: PersonalVocabularyItemSearchResult[]) =>
      api.personalVocabularyItemSearch.mock(() =>
        HttpResponse.json<PaginatedResponse<PersonalVocabularyItemSearchResult>>({
          success: true,
          data: results,
          pageInfo: { total: results.length, count: results.length },
        }),
      ),
  },
  addVocabularyItemToPersonalList: {
    mock: (responseFactory: (vocabularyItemId: string, isResetToLearning: boolean) => HttpResponse<JsonBodyType>) => {
      return http.post(`/api/v1/users/me/vocabulary-lists/personal/items`, async ({ request }) => {
        const body = (await request.json()) as { vocabularyItemId: string; isResetToLearning: boolean };

        return responseFactory(body.vocabularyItemId, body.isResetToLearning);
      });
    },
  },
  removeVocabularyItemFromPersonalList: {
    mock: (responseFactory: (userVocabularyItemId: string, isReset: boolean) => HttpResponse<JsonBodyType>) => {
      return http.delete(
        `/api/v1/users/me/vocabulary-lists/personal/items/:userVocabularyItemId`,
        async ({ params: routeParams, request }) => {
          const body = (await request.json()) as { isReset: boolean };

          return responseFactory(routeParams.userVocabularyItemId as string, body.isReset);
        },
      );
    },
  },
  uploadReading: {
    mock: (responseFactory: (file: File, title: string) => HttpResponse<JsonBodyType>) => {
      return http.post('/api/v1/users/me/readings', async ({ request }) => {
        const form = await request.formData();

        return responseFactory(form.get('file') as File, form.get('title') as string);
      });
    },
    ok: (data: Reading) => api.uploadReading.mock(() => HttpResponse.json({ success: true, data }, { status: 201 })),
  },
  generateVocabularyItem: {
    mock: (responseFactory: (value: string, context: string | undefined) => HttpResponse<JsonBodyType>) => {
      return http.post(`/api/v1/users/me/vocabulary-lists/personal/items/generate`, async ({ request }) => {
        const body = (await request.json()) as { value: string; context?: string };

        return responseFactory(body.value, body.context);
      });
    },
  },
};
