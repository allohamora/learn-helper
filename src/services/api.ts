import { hc } from 'hono/client';
import type { ClientResponse } from 'hono/client';
import type { AppType } from '@/server/api';
import type { ErrorResponse, PaginatedResponse, SuccessResponse } from '@/types/response';
import { createIsomorphicFn } from '@tanstack/react-start';

export const appClient = hc<AppType>('');

// Works on any response envelope carrying a `success: true` + `data` shape, so it covers
// SuccessResponse<T> and PaginatedResponse<T> alike without picking one apart.
export type SuccessData<T> = T extends { success: true; data: infer D } ? D : never;

const unwrapApiResponse = <T extends { success: true }>(json: T | ErrorResponse, fallback: string): T => {
  if (!json.success) throw new Error(json.error?.messages?.join(', ') || fallback);

  return json;
};

const fetchApiResponse = async <T extends { success: true }>(
  fn: () => Promise<ClientResponse<T | ErrorResponse, number, 'json'>>,
  fallback: string,
): Promise<T> => {
  const res = await fn();
  const json = await res.json();

  return unwrapApiResponse(json, fallback);
};

export const apiRequest = async <T>(
  fn: () => Promise<ClientResponse<SuccessResponse<T> | ErrorResponse, number, 'json'>>,
  fallback = 'Something went wrong',
): Promise<T> => {
  const json = await fetchApiResponse(fn, fallback);

  return json.data;
};

export const apiPaginationRequest = <T>(
  fn: () => Promise<ClientResponse<PaginatedResponse<T> | ErrorResponse, number, 'json'>>,
  fallback = 'Something went wrong',
): Promise<PaginatedResponse<T>> => fetchApiResponse(fn, fallback);

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
