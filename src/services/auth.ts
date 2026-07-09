import { createIsomorphicFn } from '@tanstack/react-start';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({ basePath: '/api/auth' });

export const getIsomorphicSession = createIsomorphicFn()
  .server(async () => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    const { auth } = await import('@/server/auth/auth.service');

    return auth.api.getSession({ headers: getRequestHeaders() });
  })
  .client(async () => {
    const { data, error } = await authClient.getSession();
    if (error) throw error;

    return data;
  });
