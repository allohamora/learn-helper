import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const api = new OpenAPIHono().basePath('/api');

const app = api.openapi(
  createRoute({
    method: 'get',
    path: '/health',
    tags: ['Health'],
    responses: {
      200: {
        description: 'Health check',
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean() }),
          },
        },
      },
    },
  }),
  async (c) => c.json({ ok: true }, 200),
);

app.doc('/swagger.json', {
  openapi: '3.1.0',
  info: { title: 'Learn Helper API', version: '0.0.1' },
  servers: [{ url: '/api' }],
});
app.get('/swagger', swaggerUI({ url: '/api/swagger.json' }));

export type AppType = typeof app;
export { app };
