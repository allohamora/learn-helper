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
import { userVocabularyListWithListDto } from './dto/user-vocabulary-list-with-list.dto';
import { userAvailableVocabularyListDto } from './dto/user-available-vocabulary-list.dto';
import { setUserVocabularyItemStatusDto } from './dto/set-user-vocabulary-item-status.dto';
import { userVocabularyItemStatusDto } from './dto/user-vocabulary-item-status.dto';
import { getUserVocabularyListItems, getUserVocabularyListProgress } from './user-vocabulary-list-item.service';
import { setUserVocabularyItemStatus } from './user-vocabulary-item.service';
import {
  getUserAvailableVocabularyLists,
  getUserVocabularyListWithListOrThrow,
} from './user-vocabulary-list.repository';
import { addVocabularyListToUser } from './user-vocabulary-list.service';

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

      return c.json(...toSuccessResponse({ status: 200, data: await getUserAvailableVocabularyLists(user.id) }));
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
      path: '/{userVocabularyListId}',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7() }),
      },
      responses: {
        ...successOkResponse({
          description: "The user's list, with the vocabulary list it points to",
          schema: userVocabularyListWithListDto,
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
          data: await getUserVocabularyListWithListOrThrow({ userId: user.id, userVocabularyListId }),
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
          data: await getUserVocabularyListItems({ userId: user.id, userVocabularyListId, ...query }),
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
          description: "The user's progress counts for the list",
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
          data: await getUserVocabularyListProgress({ userId: user.id, userVocabularyListId }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'patch',
      path: '/{userVocabularyListId}/items/{userVocabularyItemId}/status',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7(), userVocabularyItemId: z.uuidv7() }),
        body: {
          content: {
            'application/json': {
              schema: setUserVocabularyItemStatusDto,
            },
          },
        },
      },
      responses: {
        ...successOkResponse({ description: "The item's updated status", schema: userVocabularyItemStatusDto }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { userVocabularyListId, userVocabularyItemId } = c.req.valid('param');
      const body = c.req.valid('json');

      return c.json(
        ...toSuccessResponse({
          status: 200,
          data: await setUserVocabularyItemStatus({
            userId: user.id,
            userVocabularyListId,
            userVocabularyItemId,
            ...body,
          }),
        }),
      );
    },
  );
