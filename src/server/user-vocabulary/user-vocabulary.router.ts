import '@tanstack/react-start/server-only';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  errorBadRequestResponse,
  errorConflictResponse,
  errorForbiddenResponse,
  errorNotFoundResponse,
  successCreatedResponse,
  successOkResponse,
  successPaginatedResponse,
  toPaginatedResponse,
  toSuccessResponse,
} from '../utils/response.utils';
import { authMiddleware } from '../auth/auth.middleware';
import { rateLimit } from '../auth/rate-limit.middleware';
import { eventDto } from '../event/dtos/event.dto';
import { addVocabularyItemToListDto } from './dtos/add-vocabulary-item-to-list.dto';
import { removeVocabularyItemFromListDto } from './dtos/remove-vocabulary-item-from-list.dto';
import { userVocabularyListItemsFilterDto } from './dtos/user-vocabulary-list-items-filter.dto';
import { personalVocabularyItemSearchFilterDto } from './dtos/personal-vocabulary-item-search-filter.dto';
import { personalVocabularyItemSearchResultDto } from './dtos/personal-vocabulary-item-search-result.dto';
import { userVocabularyItemWithRelationsDto } from './dtos/user-vocabulary-item-with-relations.dto';
import { userVocabularyListLearnTasksDto } from './dtos/user-vocabulary-item-task.dto';
import { userVocabularyListProgressDto } from './dtos/user-vocabulary-list-progress.dto';
import { userVocabularyListWithRelationsDto } from './dtos/user-vocabulary-list-with-relations.dto';
import { userAvailableVocabularyListDto } from './dtos/user-available-vocabulary-list.dto';
import { discoverUserVocabularyItemDto } from './dtos/discover-user-vocabulary-item.dto';
import { updateUserVocabularyItemTranslationDto } from './dtos/update-user-vocabulary-item-translation.dto';
import { createVocabularyListLearnEventsDto } from './dtos/create-vocabulary-list-learn-events.dto';
import { generateVocabularyItemDto } from '../vocabulary/dtos/generate-vocabulary-item.dto';
import {
  getUserVocabularyListItems,
  getUserVocabularyListLearnItems,
  getUserVocabularyListLearnTasks,
  getUserVocabularyListProgress,
  createVocabularyListLearnEvents,
  moveUserVocabularyItemToNextStep,
  discoverUserVocabularyItem,
  resetUserVocabularyItemStatus,
  undoUserVocabularyItemStatus,
  updateUserVocabularyItemTranslation,
} from './user-vocabulary-item.service';
import {
  addVocabularyItemToPersonalList,
  addVocabularyListToUser,
  generateVocabularyItem,
  getUserVocabularyListWithRelationsOrThrow,
  removeVocabularyItemFromPersonalList,
  searchPersonalVocabularyListItems,
} from './user-vocabulary-list.service';
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
          schema: userVocabularyListWithRelationsDto,
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
          schema: userVocabularyListWithRelationsDto,
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
          data: await getUserVocabularyListWithRelationsOrThrow({ userId: user.id, userVocabularyListId }),
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
          description: "List's items with the user's progress",
          schema: userVocabularyItemWithRelationsDto,
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
      method: 'post',
      path: '/{userVocabularyListId}/items',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7() }),
        body: {
          content: {
            'application/json': {
              schema: addVocabularyItemToListDto,
            },
          },
        },
      },
      responses: {
        ...successCreatedResponse({
          description: "The word linked to the user's personal list, with the user's progress on it",
          schema: userVocabularyItemWithRelationsDto,
        }),
        ...errorForbiddenResponse({ description: 'The list is not personal or does not belong to the user' }),
        ...errorConflictResponse({ description: 'The word is already in the list' }),
        ...errorNotFoundResponse({ description: 'The list or word was not found' }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { userVocabularyListId } = c.req.valid('param');
      const { vocabularyItemId, isResetToLearning } = c.req.valid('json');

      return c.json(
        ...toSuccessResponse({
          status: 201,
          data: await addVocabularyItemToPersonalList({
            userId: user.id,
            userVocabularyListId,
            vocabularyItemId,
            isResetToLearning,
          }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'delete',
      path: '/{userVocabularyListId}/items/{userVocabularyItemId}',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7(), userVocabularyItemId: z.uuidv7() }),
        body: {
          content: {
            'application/json': {
              schema: removeVocabularyItemFromListDto,
            },
          },
        },
      },
      responses: {
        ...successOkResponse({
          description: "The word unlinked from the user's personal list; progress is preserved unless isReset was set",
          schema: z.object({ userVocabularyItemId: z.uuidv7() }),
        }),
        ...errorForbiddenResponse({ description: 'The list is not personal or does not belong to the user' }),
        ...errorNotFoundResponse({ description: 'The list, item, or link was not found' }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { userVocabularyListId, userVocabularyItemId } = c.req.valid('param');
      const { isReset } = c.req.valid('json');

      return c.json(
        ...toSuccessResponse({
          status: 200,
          data: await removeVocabularyItemFromPersonalList({
            userId: user.id,
            userVocabularyListId,
            userVocabularyItemId,
            isReset,
          }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/{userVocabularyListId}/items/generate',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7() }),
        body: {
          content: {
            'application/json': {
              schema: generateVocabularyItemDto,
            },
          },
        },
      },
      responses: {
        ...successCreatedResponse({
          description:
            "The AI-generated word, persisted and linked to the user's personal list, with the user's progress on it",
          schema: userVocabularyItemWithRelationsDto,
        }),
        ...errorForbiddenResponse({ description: 'The list is not personal or does not belong to the user' }),
        ...errorConflictResponse({
          description: 'A vocabulary item with the generated value and part of speech already exists',
        }),
        ...errorBadRequestResponse({ description: 'The value is not a learnable word or fixed phrase' }),
        ...errorNotFoundResponse({ description: 'The list was not found' }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware, rateLimit({ count: 20, durationSec: 60 })] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { userVocabularyListId } = c.req.valid('param');
      const body = c.req.valid('json');

      return c.json(
        ...toSuccessResponse({
          status: 201,
          data: await generateVocabularyItem({ userId: user.id, userVocabularyListId, ...body }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/{userVocabularyListId}/search',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7() }),
        query: personalVocabularyItemSearchFilterDto,
      },
      responses: {
        ...successPaginatedResponse({
          description: "Vocabulary items matching the search value, with the personal list's join state",
          schema: personalVocabularyItemSearchResultDto,
        }),
        ...errorForbiddenResponse({ description: 'The list is not personal or does not belong to the user' }),
        ...errorNotFoundResponse({ description: 'The list was not found' }),
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
          data: await searchPersonalVocabularyListItems({ userId: user.id, userVocabularyListId, ...query }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/{userVocabularyListId}/learn/items',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7() }),
      },
      responses: {
        ...successOkResponse({
          description: "A batch of the list's items for a Learn session",
          schema: z.array(userVocabularyItemWithRelationsDto),
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
          data: await getUserVocabularyListLearnItems({ userId: user.id, userVocabularyListId }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/{userVocabularyListId}/learn/tasks',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7() }),
      },
      responses: {
        ...successOkResponse({
          description: 'AI-generated sentence-arrangement tasks for the current Learn batch',
          schema: userVocabularyListLearnTasksDto,
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
          data: await getUserVocabularyListLearnTasks({ userId: user.id, userVocabularyListId }),
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
      method: 'post',
      path: '/{userVocabularyListId}/learn/events',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7() }),
        body: {
          content: {
            'application/json': {
              schema: createVocabularyListLearnEventsDto,
            },
          },
        },
      },
      responses: {
        ...successCreatedResponse({
          description: 'Learn events created',
          schema: z.array(eventDto),
        }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { userVocabularyListId } = c.req.valid('param');
      const body = c.req.valid('json');

      return c.json(
        ...toSuccessResponse({
          status: 201,
          data: await createVocabularyListLearnEvents({ ...body, userId: user.id, userVocabularyListId }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/{userVocabularyListId}/items/{userVocabularyItemId}/discover',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7(), userVocabularyItemId: z.uuidv7() }),
        body: {
          content: {
            'application/json': {
              schema: discoverUserVocabularyItemDto,
            },
          },
        },
      },
      responses: {
        ...successOkResponse({
          description: 'The discovered item with its resulting status and related vocabulary item',
          schema: userVocabularyItemWithRelationsDto,
        }),
        ...errorConflictResponse({ description: 'The item has already been discovered' }),
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
          data: await discoverUserVocabularyItem({
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
          description: "The item's progress reset to waiting",
          schema: userVocabularyItemWithRelationsDto,
        }),
        ...errorConflictResponse({ description: 'The item is already waiting' }),
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
      path: '/{userVocabularyListId}/items/{userVocabularyItemId}/reset',
      tags: ['Vocabulary'],
      request: {
        params: z.object({ userVocabularyListId: z.uuidv7(), userVocabularyItemId: z.uuidv7() }),
      },
      responses: {
        ...successOkResponse({
          description: "The item's progress reset to waiting",
          schema: userVocabularyItemWithRelationsDto,
        }),
        ...errorConflictResponse({ description: 'The item is already waiting' }),
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
          data: await resetUserVocabularyItemStatus({ userId: user.id, userVocabularyListId, userVocabularyItemId }),
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
          schema: userVocabularyItemWithRelationsDto,
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
          description: 'The item with its updated related vocabulary item',
          schema: userVocabularyItemWithRelationsDto,
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
