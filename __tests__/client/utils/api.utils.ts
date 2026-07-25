import { http, HttpResponse } from 'msw';
import type { JsonBodyType } from 'msw';
import type { Statistics } from '@/server/statistics/dtos/statistics.dto';

type StatisticsResponse = {
  success: true;
  data: Statistics;
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
};
