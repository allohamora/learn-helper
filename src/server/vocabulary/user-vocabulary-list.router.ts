import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { successOkResponse, toSuccessResponse } from '../utils/response.utils';
import { authMiddleware, getAuthContext } from '../auth/auth.middleware';
import { userVocabularyListSchema } from './dto/user-vocabulary-list.dto';
import { vocabularyListSchema } from './dto/vocabulary-list.dto';
import { getAvailableVocabularyLists } from './vocabulary-list.repository';
import { addVocabularyListToUser } from './vocabulary-list.service';

export const userVocabularyListRouter = new OpenAPIHono()
  .openapi(
    createRoute({
      method: 'get',
      path: '/available',
      tags: ['Vocabulary'],
      responses: {
        ...successOkResponse({ description: 'List of vocabulary lists', schema: z.array(vocabularyListSchema) }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware],
    }),
    async (c) => {
      const { user } = getAuthContext(c);

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
              schema: z.object({ id: z.uuid() }),
            },
          },
        },
      },
      responses: {
        ...successOkResponse({ description: 'List added to the user', schema: userVocabularyListSchema }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware],
    }),
    async (c) => {
      const { user } = getAuthContext(c);
      const { id } = c.req.valid('json');

      return c.json(...toSuccessResponse({ status: 200, data: await addVocabularyListToUser(user.id, id) }));
    },
  );
