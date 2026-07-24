import '@tanstack/react-start/server-only';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../auth/auth.middleware';
import { successOkResponse, toSuccessResponse } from '../utils/response.utils';
import { statisticsDto } from './dtos/statistics.dto';
import { getStatistics } from './statistics.service';

export const statisticsRouter = new OpenAPIHono().openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Statistics'],
    responses: {
      ...successOkResponse({
        description: "The authenticated user's event-based statistics",
        schema: statisticsDto,
      }),
    },
    security: [{ cookieAuth: [] }],
    middleware: [authMiddleware] as const,
  }),
  async (c) => {
    const user = c.get('user');

    return c.json(...toSuccessResponse({ status: 200, data: await getStatistics({ userId: user.id }) }));
  },
);
