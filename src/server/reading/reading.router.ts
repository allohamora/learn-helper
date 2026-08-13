import '@tanstack/react-start/server-only';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { bodyLimit } from 'hono/body-limit';
import {
  errorBadRequestResponse,
  errorConflictResponse,
  successCreatedResponse,
  successPaginatedResponse,
  toPaginatedResponse,
  toSuccessResponse,
} from '../utils/response.utils';
import { Exception } from '../utils/exception.utils';
import { MimeType } from '../utils/mime-type.utils';
import { authMiddleware } from '../auth/auth.middleware';
import { rateLimit } from '../auth/rate-limit.middleware';
import { listReadingsFilterDto } from './dtos/list-readings-filter.dto';
import { readingDto } from './dtos/reading.dto';
import { getReadingsByUserId } from './reading.repository';
import { uploadReading } from './reading.service';

const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export const readingRouter = new OpenAPIHono()
  .openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['Readings'],
      request: {
        query: listReadingsFilterDto,
      },
      responses: {
        ...successPaginatedResponse({
          description: "The user's readings, newest first",
          schema: readingDto,
        }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const query = c.req.valid('query');

      return c.json(
        ...toPaginatedResponse({
          status: 200,
          data: await getReadingsByUserId({ userId: user.id, ...query }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['Readings'],
      request: {
        body: {
          content: {
            'multipart/form-data': {
              schema: z.object({
                file: z.instanceof(File).refine((file) => file.type === MimeType.Pdf, {
                  message: 'only application/pdf files are supported',
                }),
                title: z.string().optional(),
              }),
            },
          },
        },
      },
      responses: {
        ...successCreatedResponse({
          description: 'The uploaded reading',
          schema: readingDto,
        }),
        ...errorBadRequestResponse({
          description: 'Missing file, wrong mime type, over the size limit, or a corrupt PDF',
        }),
        ...errorConflictResponse({ description: 'This file was already uploaded' }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [
        bodyLimit({
          maxSize: MAX_UPLOAD_SIZE_BYTES,
          onError: () => {
            throw Exception.badRequest(`file exceeds the ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB limit`);
          },
        }),
        authMiddleware,
        rateLimit({ count: 10, durationSec: 60 }),
      ] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { file, title } = c.req.valid('form');

      return c.json(
        ...toSuccessResponse({
          status: 201,
          data: await uploadReading({ userId: user.id, file, title }),
        }),
      );
    },
  );
