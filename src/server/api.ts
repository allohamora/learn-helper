import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { auth } from './auth/client';
import { Exception } from './utils/exception';
import { HTTPException } from 'hono/http-exception';
import { successOkResponse, toErrorResponse, toSuccessResponse } from './utils/response';
import { authMiddleware } from './auth/middleware';

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

const app = api.openapi(
  createRoute({
    method: 'get',
    path: '/health',
    tags: ['Health'],
    responses: {
      ...successOkResponse({ description: 'Health check', schema: z.object({ ok: z.boolean() }) }),
    },
    middleware: [authMiddleware],
  }),
  async (c) => c.json(...toSuccessResponse({ status: 200, data: { ok: true } })),
);

app.doc('/swagger.json', {
  openapi: '3.1.0',
  info: { title: 'Learn Helper API', version: '0.0.1' },
  servers: [{ url: '/api' }],
});
app.get('/swagger', swaggerUI({ url: '/api/swagger.json' }));

export type AppType = typeof app;
export { app };
