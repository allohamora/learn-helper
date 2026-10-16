import type { InfiniteData } from '@tanstack/react-query';
import { hc } from 'hono/client';
import type { ClientResponse } from 'hono/client';
import type { AppType } from '@/server/api';
import type { ErrorResponse, PaginatedResponse, SuccessResponse } from '@/types/response';
import { createIsomorphicFn } from '@tanstack/react-start';
import { MimeType } from '@/const/mime-type';

export const appClient = hc<AppType>('');

export type SuccessData<T> = T extends { success: true; data: infer D } ? D : never;

const unwrapApiResponse = <T extends { success: true }>(json: T | ErrorResponse, fallback: string): T => {
  if (!json.success) throw new Error(json.error?.messages?.join(', ') || fallback);

  return json;
};

const fetchApiResponse = async <T extends { success: true }>(
  fn: () => Promise<ClientResponse<T | ErrorResponse, number, 'json'>>,
  fallback = 'Something went wrong',
): Promise<T> => {
  const res = await fn();
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes(MimeType.Json)) throw new Error(`Unexpected response content type: ${contentType}`);

  const json = await res.json();

  return unwrapApiResponse(json, fallback);
};

export const apiRequest = async <T>(
  fn: () => Promise<ClientResponse<SuccessResponse<T> | ErrorResponse, number, 'json'>>,
  fallback?: string,
): Promise<T> => {
  const json = await fetchApiResponse(fn, fallback);

  return json.data;
};

export const apiPaginationRequest = <T>(
  fn: () => Promise<ClientResponse<PaginatedResponse<T> | ErrorResponse, number, 'json'>>,
  fallback?: string,
): Promise<PaginatedResponse<T>> => fetchApiResponse(fn, fallback);

export const paginatedQueryOptions = <T>(fetchPage: (cursor: string | undefined) => Promise<PaginatedResponse<T>>) => ({
  initialPageParam: undefined as string | undefined,
  queryFn: ({ pageParam }: { pageParam: string | undefined }) => fetchPage(pageParam),
  getNextPageParam: (lastPage: PaginatedResponse<T>) => lastPage.pageInfo.nextCursor,
  select: (data: InfiniteData<PaginatedResponse<T>, string | undefined>) => data.pages.flatMap((page) => page.data),
});

export const getIsomorphicAppClient = createIsomorphicFn()
  .server(async () => {
    const { app } = await import('@/server/api');
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    const headers = Object.fromEntries(getRequestHeaders().entries());

    return hc<AppType>('', {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => await app.request(input, init),
      headers,
    });
  })
  .client(() => {
    return appClient;
  });
