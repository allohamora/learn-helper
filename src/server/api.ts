import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { auth } from './auth/auth.service';
import { Exception } from './utils/exception.utils';
import { HTTPException } from 'hono/http-exception';
import { toErrorResponse } from './utils/response.utils';
import { healthRouter } from './health/health.router';

declare module 'hono' {
  interface ContextVariableMap {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  }
}

const api = new OpenAPIHono().basePath('/api');

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

const v1Router = new OpenAPIHono().route('/health', healthRouter);

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
