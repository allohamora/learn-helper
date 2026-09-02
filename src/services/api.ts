import { hc } from 'hono/client';
import type { ClientResponse } from 'hono/client';
import type { SuccessStatusCode } from 'hono/utils/http-status';
import type { AppType } from '@/server/api';
import type { ErrorResponse, PaginatedResponse, SuccessResponse } from '@/types/response';
import { createIsomorphicFn } from '@tanstack/react-start';

export const appClient = hc<AppType>('');

// Works on any response envelope carrying a `success: true` + `data` shape, so it covers
// SuccessResponse<T> and PaginatedResponse<T> alike without picking one apart.
export type SuccessData<T> = T extends { success: true; data: infer D } ? D : never;

// Distributes over the union of per-status ClientResponse types hono's client infers for a route,
// keeping only the success-status arm's data shape.
type EndpointData<R> =
  R extends ClientResponse<infer O, infer S, 'json'> ? (S extends SuccessStatusCode ? SuccessData<O> : never) : never;

// Same, but for a paginated endpoint: extracts the item type instead of the whole `data` array.
type EndpointItem<R> =
  R extends ClientResponse<infer O, infer S, 'json'>
    ? S extends SuccessStatusCode
      ? O extends PaginatedResponse<infer D>
        ? D
        : never
      : never
    : never;

export const apiRequest = async <R extends ClientResponse<unknown, number, 'json'>>(
  fn: () => Promise<R>,
  fallback = 'Something went wrong',
): Promise<EndpointData<R>> => {
  const res = await fn();
  const json = (await res.json()) as SuccessResponse<EndpointData<R>> | ErrorResponse;
  if (!json.success) throw new Error(json.error?.messages?.join(', ') || fallback);

  return json.data as EndpointData<R>;
};

export const apiPaginationRequest = async <R extends ClientResponse<unknown, number, 'json'>>(
  fn: () => Promise<R>,
  fallback = 'Something went wrong',
): Promise<PaginatedResponse<EndpointItem<R>>> => {
  const res = await fn();
  const json = (await res.json()) as PaginatedResponse<EndpointItem<R>> | ErrorResponse;
  if (!json.success) throw new Error(json.error?.messages?.join(', ') || fallback);

  return json;
};

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
