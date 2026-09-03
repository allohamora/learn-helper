import '@tanstack/react-start/server-only';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { bodyLimit } from 'hono/body-limit';
import {
  errorBadRequestResponse,
  errorConflictResponse,
  errorNotFoundResponse,
  successCreatedResponse,
  successOkResponse,
  successPaginatedResponse,
  toPaginatedResponse,
  toSuccessResponse,
} from '../utils/response.utils';
import { Exception } from '../utils/exception.utils';
import { MimeType } from '@/const/mime-type';
import { authMiddleware } from '../auth/auth.middleware';
import { rateLimit } from '../auth/rate-limit.middleware';
import { listReadingsFilterDto } from './dtos/list-readings-filter.dto';
import { readingDto } from './dtos/reading.dto';
import { translateSelectionDto } from './dtos/translate-selection.dto';
import { translateSelectionResultDto } from './dtos/translate-selection-result.dto';
import { updateReadingStateDto } from './dtos/update-reading-state.dto';
import { getReadingsByUserId } from './reading.repository';
import {
  downloadReading,
  getReadingByIdAndUserIdOrThrow,
  removeReading,
  translateReadingSelection,
  updateReadingState,
  uploadReading,
} from './reading.service';

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
        // TODO: Hono has no streaming multipart parser: the form validator buffers the whole body into memory
        // (via c.req.arrayBuffer()) before this schema runs, so `file` below is already fully loaded, not a stream.
        body: {
          content: {
            'multipart/form-data': {
              schema: z.object({
                file: z.instanceof(File).refine((file) => file.type === MimeType.Pdf, {
                  message: 'Only application/pdf files are supported',
                }),
                title: z.string().trim().min(1, 'Title is required'),
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
            throw Exception.badRequest(`File exceeds the ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB limit`);
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
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/{readingId}',
      tags: ['Readings'],
      request: {
        params: z.object({ readingId: z.uuidv7() }),
      },
      responses: {
        ...successOkResponse({ description: 'The reading', schema: readingDto }),
        ...errorNotFoundResponse({ description: 'The reading was not found' }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { readingId } = c.req.valid('param');

      return c.json(
        ...toSuccessResponse({
          status: 200,
          data: await getReadingByIdAndUserIdOrThrow({ userId: user.id, readingId }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'patch',
      path: '/{readingId}/state',
      tags: ['Readings'],
      request: {
        params: z.object({ readingId: z.uuidv7() }),
        body: {
          content: {
            'application/json': {
              schema: updateReadingStateDto,
            },
          },
        },
      },
      responses: {
        ...successOkResponse({ description: 'The reading with its updated state', schema: readingDto }),
        ...errorBadRequestResponse({ description: 'currentPage or addDurationMs failed validation' }),
        ...errorNotFoundResponse({ description: 'The reading was not found' }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware, rateLimit({ count: 30, durationSec: 60 })] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { readingId } = c.req.valid('param');
      const body = c.req.valid('json');

      return c.json(
        ...toSuccessResponse({
          status: 200,
          data: await updateReadingState({ userId: user.id, readingId, ...body }),
        }),
      );
    },
  )
  .openapi(
    createRoute({
      method: 'delete',
      path: '/{readingId}',
      tags: ['Readings'],
      request: {
        params: z.object({ readingId: z.uuidv7() }),
      },
      responses: {
        ...successOkResponse({
          description: 'The reading was deleted',
          schema: z.object({ readingId: z.uuidv7() }),
        }),
        ...errorNotFoundResponse({ description: 'The reading was not found' }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { readingId } = c.req.valid('param');

      await removeReading({ userId: user.id, readingId });

      return c.json(...toSuccessResponse({ status: 200, data: { readingId } }));
    },
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/{readingId}/download',
      tags: ['Readings'],
      request: {
        params: z.object({ readingId: z.uuidv7() }),
      },
      responses: {
        200: {
          description: 'The reading PDF file',
          content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
        },
        304: {
          description: 'Not modified — the cached copy (matched by If-None-Match) is still current',
        },
        ...errorNotFoundResponse({ description: 'The reading was not found' }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { readingId } = c.req.valid('param');

      const { hash, fileName, mimeType, sizeBytes, getStream } = await downloadReading({
        userId: user.id,
        readingId,
      });

      // ETag values must be double-quoted per RFC 7232 for clients to send them back correctly in If-None-Match
      const etag = `"${hash}"`;

      c.header('ETag', etag);
      c.header('Cache-Control', 'private, no-cache');

      if (c.req.header('If-None-Match') === etag) {
        return c.newResponse(null, 304);
      }

      c.header('Content-Type', mimeType);
      c.header('Content-Length', String(sizeBytes));
      c.header('Content-Disposition', `inline; filename="${fileName}"`);

      return c.newResponse(await getStream(), 200);
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/{readingId}/translations',
      tags: ['Translation'],
      request: {
        params: z.object({ readingId: z.uuidv7() }),
        body: {
          content: {
            'application/json': {
              schema: translateSelectionDto,
            },
          },
        },
      },
      responses: {
        ...successOkResponse({
          description: 'Translation of the selected text, and whether it is short enough to add to the learning list',
          schema: translateSelectionResultDto,
        }),
        ...errorNotFoundResponse({ description: 'The reading was not found' }),
      },
      security: [{ cookieAuth: [] }],
      middleware: [authMiddleware, rateLimit({ count: 30, durationSec: 60 })] as const,
    }),
    async (c) => {
      const user = c.get('user');
      const { readingId } = c.req.valid('param');
      const body = c.req.valid('json');

      return c.json(
        ...toSuccessResponse({
          status: 200,
          data: await translateReadingSelection({ userId: user.id, readingId, ...body }),
        }),
      );
    },
  );
