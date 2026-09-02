import '@tanstack/react-start/server-only';
import { swaggerUI } from '@hono/swagger-ui';
import { Scalar } from '@scalar/hono-api-reference';
import { OpenAPIHono } from '@hono/zod-openapi';
import { auth } from './auth/auth.service';
import { Exception } from './utils/exception.utils';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { toErrorResponse } from './utils/response.utils';
import { userVocabularyRouter } from './user-vocabulary/user-vocabulary.router';
import { createLogger } from './utils/logger.utils';
import type { Context } from 'hono';
import { MimeType } from '@/const/mime-type';
import { statisticsRouter } from './statistics/statistics.router';
import { readingRouter } from './reading/reading.router';
import { setUser } from './instrument';

declare module 'hono' {
  interface ContextVariableMap {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  }
}

const logger = createLogger('api');

const api = new OpenAPIHono({
  defaultHook: (result) => {
    if (!result.success) {
      throw Exception.badRequest('Validation failed', { issues: result.error.issues });
    }
  },
}).basePath('/api');

api.use(secureHeaders());

const isSsrUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);

    // by default hc setups 'http://localhost' without a port for app.request() calls
    return parsedUrl.origin === 'http://localhost';
  } catch {
    return false;
  }
};

const getBody = async (c: Context) => {
  if (c.req.header('Content-Type') !== MimeType.Json) {
    return;
  }

  try {
    return await c.req.json();
  } catch (err) {
    logger.error({ msg: 'error while parsing the body as a json', err });
  }

  try {
    return await c.req.text();
  } catch (err) {
    logger.error({ msg: 'error while parsing the body as a text', err });
  }
};

// onError only catches thrown errors, so responses returned directly with an error status
// (e.g. zod-openapi validation failures, better-auth's handler) would otherwise go unlogged
api.use(async (c, next) => {
  await next();

  if (c.res.status >= 400) {
    const msg = await c.res.clone().text();
    const body = await getBody(c);

    logger.error({
      method: c.req.method,
      path: c.req.path,
      url: c.req.url,
      isSsr: isSsrUrl(c.req.url),
      query: c.req.query(),
      body,
      userId: c.get('user')?.id,
      sessionId: c.get('session')?.id,
      status: c.res.status,
      err: c.error ?? new Error(msg),
    });
  }
});

api.onError((err, c) => {
  if (err instanceof Exception) {
    return c.json(...err.toHttpResponse());
  }

  const statusText = err instanceof HTTPException ? err.message : 'internal server error';
  const statusCode = err instanceof HTTPException ? err.status : 500;

  return c.json(
    ...toErrorResponse({
      status: statusCode,
      messages: [statusText],
      code: 'HTTP_EXCEPTION',
    }),
  );
});

api.use('*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set('user', null);
    c.set('session', null);
    setUser(null);
  } else {
    c.set('user', session.user);
    c.set('session', session.session);
    setUser({ id: session.user.id, email: session.user.email, username: session.user.name });
  }

  await next();
});

api.on(['POST', 'GET'], '/auth/*', (c) => {
  return auth.handler(c.req.raw);
});

const v1Router = new OpenAPIHono()
  .route('/users/me/vocabulary-lists', userVocabularyRouter)
  .route('/users/me/statistics', statisticsRouter)
  .route('/users/me/readings', readingRouter);

const app = api.route('/v1', v1Router);

app.openAPIRegistry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'better-auth.session_token',
});

app.doc('/swagger.json', {
  openapi: '3.1.0',
  info: { title: 'Learn Helper API', version: '0.0.1' },
});
app.get('/swagger', swaggerUI({ url: '/api/swagger.json' }));
app.get('/scalar', Scalar({ url: '/api/swagger.json' }));

export type AppType = typeof app;
export { app };
