import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { Exception } from '../utils/exception.utils';

export const getAuthContext = (c: Context) => {
  const user = c.get('user');
  const session = c.get('session');

  if (!user || !session) {
    throw Exception.unauthorized('No active session');
  }

  return { user, session };
};

export const authMiddleware = createMiddleware(async (c, next) => {
  // it throws an unauthorized exception if the auth is not found
  getAuthContext(c);

  await next();
});
