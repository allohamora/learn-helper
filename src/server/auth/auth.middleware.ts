import '@tanstack/react-start/server-only';
import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { auth } from './auth.service';
import { Exception } from '../utils/exception.utils';

const getAuthContext = (c: Context) => {
  const user = c.get('user');
  const session = c.get('session');

  if (!user || !session) {
    throw Exception.unauthorized('No active session');
  }

  return { user, session };
};

export const authMiddleware = createMiddleware<{
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
  };
}>(async (c, next) => {
  // it throws an unauthorized exception if the auth is not found
  getAuthContext(c);

  await next();
});
