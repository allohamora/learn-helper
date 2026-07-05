import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { auth } from './auth.service';

async function getSessionFromHeaders(headers: Headers) {
  return auth.api.getSession({ headers });
}

async function requireSessionFromHeaders(headers: Headers) {
  const session = await getSessionFromHeaders(headers);

  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  return getSessionFromHeaders(getRequestHeaders());
});

export const requireSession = createServerFn({ method: 'GET' }).handler(async () => {
  return requireSessionFromHeaders(getRequestHeaders());
});

export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    throw redirect({ to: '/login' });
  }

  return session;
}
