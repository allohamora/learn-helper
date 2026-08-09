import '@tanstack/react-start/server-only';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { successPaginatedResponse, toPaginatedResponse } from '../utils/response.utils';
import { authMiddleware } from '../auth/auth.middleware';
import { vocabularyItemFilterDto } from './dtos/vocabulary-item-filter.dto';
import { vocabularyItemDto } from './dtos/vocabulary-item.dto';
import { searchVocabularyItems } from './vocabulary-item.repository';

export const vocabularyItemRouter = new OpenAPIHono().openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Vocabulary'],
    request: { query: vocabularyItemFilterDto },
    responses: {
      ...successPaginatedResponse({
        description: 'Vocabulary items matching the search value',
        schema: vocabularyItemDto,
      }),
    },
    security: [{ cookieAuth: [] }],
    middleware: [authMiddleware] as const,
  }),
  async (c) => {
    const query = c.req.valid('query');

    return c.json(...toPaginatedResponse({ status: 200, data: await searchVocabularyItems(query) }));
  },
);
