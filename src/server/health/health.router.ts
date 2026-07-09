import '@tanstack/react-start/server-only';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { successOkResponse, toSuccessResponse } from '../utils/response.utils';
import { authMiddleware } from '../auth/auth.middleware';
import { getHealth } from './health.service';

export const healthRouter = new OpenAPIHono().openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Health'],
    responses: {
      ...successOkResponse({ description: 'Health check', schema: z.object({ ok: z.boolean() }) }),
    },
    security: [{ cookieAuth: [] }],
    middleware: [authMiddleware],
  }),
  async (c) => c.json(...toSuccessResponse({ status: 200, data: getHealth() })),
);
