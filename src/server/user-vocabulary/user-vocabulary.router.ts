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
import { rateLimit } from '../utils/rate-limit.middleware';
import { userVocabularyItemDto } from './dtos/user-vocabulary-item.dto';
import { userVocabularyListItemsFilterDto } from './dtos/user-vocabulary-list-items-filter.dto';
import { userVocabularyItemLearningDto } from './dtos/user-vocabulary-item-learning.dto';
import { userVocabularyItemProgressDto } from './dtos/user-vocabulary-item-progress.dto';
import { userVocabularyListLearningTasksDto } from './dtos/user-vocabulary-item-task.dto';
import { userVocabularyListProgressDto } from './dtos/user-vocabulary-list-progress.dto';
import { userVocabularyListWithListDto } from './dtos/user-vocabulary-list-with-list.dto';
import { userAvailableVocabularyListDto } from './dtos/user-available-vocabulary-list.dto';
import { setUserVocabularyItemStatusDto } from './dtos/set-user-vocabulary-item-status.dto';
import { updateUserVocabularyItemTranslationDto } from './dtos/update-user-vocabulary-item-translation.dto';
import { userVocabularyItemStatusDto } from './dtos/user-vocabulary-item-status.dto';
import { userVocabularyItemTranslationDto } from './dtos/user-vocabulary-item-translation.dto';
import {
  getUserVocabularyListItems,
  getUserVocabularyListLearningItems,
  getUserVocabularyListLearningTasks,
  getUserVocabularyListProgress,
  moveUserVocabularyItemToNextStep,
  setUserVocabularyItemStatus,
  undoUserVocabularyItemStatus,
  updateUserVocabularyItemTranslation,
} from './user-vocabulary-item.service';
import { addVocabularyListToUser, getUserVocabularyListWithListOrThrow } from './user-vocabulary-list.service';
import { getUserAvailableVocabularyLists } from './user-vocabulary-list.repository';

export const userVocabularyRouter = new OpenAPIHono()
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
        ...successCreatedResponse({
          description: 'List added to the user, with the vocabulary list it points to',
          schema: userVocabularyListWithListDto,
        }),
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
          schema: userVocabularyItemDto,
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
      path: '/{userVocabularyListId}/learning-items',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7() }),
      },
      responses: {
        ...successOkResponse({
          description:
            "A batch of the list's words for a Learning session, following the [new, old, old, new, old, old] pattern",
          schema: z.array(userVocabularyItemLearningDto),
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
          data: await getUserVocabularyListLearningItems({ userId: user.id, userVocabularyListId }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/{userVocabularyListId}/learning-tasks',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7() }),
      },
      responses: {
        ...successOkResponse({
          description: 'AI-generated sentence-arrangement tasks for the current learning batch',
          schema: userVocabularyListLearningTasksDto,
        }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware, rateLimit({ count: 10, durationSec: 60 })] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { userVocabularyListId } = c.req.valid('param');

      return c.json(
        ...toSuccessResponse({
          status: 200,
          data: await getUserVocabularyListLearningTasks({ userId: user.id, userVocabularyListId }),
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
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/{userVocabularyListId}/items/{userVocabularyItemId}/undo',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7(), userVocabularyItemId: z.uuidv7() }),
      },
      responses: {
        ...successOkResponse({
          description: "The item's status reverted to waiting",
          schema: userVocabularyItemStatusDto,
        }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { userVocabularyListId, userVocabularyItemId } = c.req.valid('param');

      return c.json(
        ...toSuccessResponse({
          status: 200,
          data: await undoUserVocabularyItemStatus({ userId: user.id, userVocabularyListId, userVocabularyItemId }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/{userVocabularyListId}/items/{userVocabularyItemId}/move-to-next-step',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7(), userVocabularyItemId: z.uuidv7() }),
      },
      responses: {
        ...successOkResponse({
          description: "The item's encounter count incremented, and status advanced to learned or re-queued for review",
          schema: userVocabularyItemProgressDto,
        }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { userVocabularyListId, userVocabularyItemId } = c.req.valid('param');

      return c.json(
        ...toSuccessResponse({
          status: 200,
          data: await moveUserVocabularyItemToNextStep({
            userId: user.id,
            userVocabularyListId,
            userVocabularyItemId,
          }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'patch',
      path: '/{userVocabularyListId}/items/{userVocabularyItemId}/translation',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7(), userVocabularyItemId: z.uuidv7() }),
        body: {
          content: {
            'application/json': {
              schema: updateUserVocabularyItemTranslationDto,
            },
          },
        },
      },
      responses: {
        ...successOkResponse({
          description: "The item's updated translation",
          schema: userVocabularyItemTranslationDto,
        }),
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
          data: await updateUserVocabularyItemTranslation({
            userId: user.id,
            userVocabularyListId,
            userVocabularyItemId,
            ...body,
          }),
        }),
      );
    },
  );
