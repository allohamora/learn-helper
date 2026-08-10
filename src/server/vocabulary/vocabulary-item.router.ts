import '@tanstack/react-start/server-only';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  successOkResponse,
  successPaginatedResponse,
  toPaginatedResponse,
  toSuccessResponse,
} from '../utils/response.utils';
import { authMiddleware } from '../auth/auth.middleware';
import { rateLimit } from '../auth/rate-limit.middleware';
import { vocabularyItemFilterDto } from './dtos/vocabulary-item-filter.dto';
import { vocabularyItemDto } from './dtos/vocabulary-item.dto';
import { generateVocabularyItemDto } from './dtos/generate-vocabulary-item.dto';
import { generatedVocabularyItemDto } from './dtos/generated-vocabulary-item.dto';
import { searchVocabularyItems } from './vocabulary-item.repository';
import { generateVocabularyItem } from './vocabulary-item.service';

export const vocabularyItemRouter = new OpenAPIHono()
  .openapi(
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
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/generate',
      tags: ['Vocabulary'],
      request: {
        body: {
          content: {
            'application/json': {
              schema: generateVocabularyItemDto,
            },
          },
        },
      },
      responses: {
        ...successOkResponse({
          description: 'AI-generated vocabulary item data for the given value and context',
          schema: generatedVocabularyItemDto,
        }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware, rateLimit({ count: 20, durationSec: 60 })] as const,
    }),
    async (c) => {
      const body = c.req.valid('json');
      const user = c.get('user');
      const output = await generateVocabularyItem({ ...body, userId: user.id });

      return c.json(...toSuccessResponse({ status: 200, data: output }));
    },
  );
