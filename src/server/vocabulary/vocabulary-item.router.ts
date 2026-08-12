import '@tanstack/react-start/server-only';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { successOkResponse, toSuccessResponse } from '../utils/response.utils';
import { authMiddleware } from '../auth/auth.middleware';
import { rateLimit } from '../auth/rate-limit.middleware';
import { generateVocabularyItemDto } from './dtos/generate-vocabulary-item.dto';
import { generatedVocabularyItemDto } from './dtos/generated-vocabulary-item.dto';
import { generateVocabularyItem } from './vocabulary-item.service';

export const vocabularyItemRouter = new OpenAPIHono().openapi(
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
