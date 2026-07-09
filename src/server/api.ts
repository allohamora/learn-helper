import '@tanstack/react-start/server-only';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { auth } from './auth/auth.service';
import { Exception } from './utils/exception.utils';
import { HTTPException } from 'hono/http-exception';
import { toErrorResponse } from './utils/response.utils';
import { healthRouter } from './health/health.router';
import { userVocabularyListRouter } from './vocabulary/user-vocabulary-list.router';
import { createLogger } from './utils/logger.utils';
import type { Context } from 'hono';
import { MimeType } from './utils/mime-type.utils';

declare module 'hono' {
  interface ContextVariableMap {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  }
}

const logger = createLogger('api');

const api = new OpenAPIHono().basePath('/api');

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
  } else {
    c.set('user', session.user);
    c.set('session', session.session);
  }

  await next();
});

api.on(['POST', 'GET'], '/auth/*', (c) => {
  return auth.handler(c.req.raw);
});

const v1Router = new OpenAPIHono()
  .route('/health', healthRouter)
  .route('/users/me/vocabulary-lists', userVocabularyListRouter);

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

export type AppType = typeof app;
export { app };
