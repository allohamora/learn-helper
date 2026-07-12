import '@tanstack/react-start/server-only';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  successCreatedResponse,
  successOkResponse,
  successPaginatedResponse,
  toPaginatedResponse,
  toSuccessResponse,
} from '../utils/response.utils';
import { authMiddleware } from '../auth/auth.middleware';
import { userVocabularyListItemDto } from './dto/user-vocabulary-list-item.dto';
import { userVocabularyListItemsFilterDto } from './dto/user-vocabulary-list-items-filter.dto';
import { userVocabularyListProgressDto } from './dto/user-vocabulary-list-progress.dto';
import { userVocabularyListDto } from './dto/user-vocabulary-list.dto';
import { userAvailableVocabularyListDto } from './dto/user-available-vocabulary-list.dto';
import { getVocabularyListItems, getVocabularyListProgress } from './vocabulary-list-item.service';
import { getAvailableVocabularyLists } from './vocabulary-list.repository';
import { addVocabularyListToUser } from './vocabulary-list.service';

export const userVocabularyListRouter = new OpenAPIHono()
  .openapi(
    createRoute({
      method: 'get',
      path: '/available',
      tags: ['Vocabulary'],
      responses: {
        ...successOkResponse({
          description: 'List of vocabulary lists',
          schema: z.array(userAvailableVocabularyListDto),
        }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');

      return c.json(...toSuccessResponse({ status: 200, data: await getAvailableVocabularyLists(user.id) }));
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['Vocabulary'],
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({ vocabularyListId: z.uuidv7() }),
            },
          },
        },
      },
      responses: {
        ...successCreatedResponse({ description: 'List added to the user', schema: userVocabularyListDto }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { vocabularyListId } = c.req.valid('json');

      return c.json(
        ...toSuccessResponse({
          status: 201,
          data: await addVocabularyListToUser({ userId: user.id, vocabularyListId }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/{userVocabularyListId}/items',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7() }),
        query: userVocabularyListItemsFilterDto,
      },
      responses: {
        ...successPaginatedResponse({
          description: "List's words with the user's progress",
          schema: userVocabularyListItemDto,
        }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { userVocabularyListId } = c.req.valid('param');
      const query = c.req.valid('query');

      return c.json(
        ...toPaginatedResponse({
          status: 200,
          data: await getVocabularyListItems({ userId: user.id, userVocabularyListId, ...query }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/{userVocabularyListId}/progress',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7() }),
      },
      responses: {
        ...successOkResponse({
          description: "List's title and the user's progress",
          schema: userVocabularyListProgressDto,
        }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { userVocabularyListId } = c.req.valid('param');

      return c.json(
        ...toSuccessResponse({
          status: 200,
          data: await getVocabularyListProgress({ userId: user.id, userVocabularyListId }),
        }),
      );
    },
  );
