import { hc } from 'hono/client';
import type { AppType } from '@/server/api';
import { createIsomorphicFn } from '@tanstack/react-start';

export const appClient = hc<AppType>('');

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
