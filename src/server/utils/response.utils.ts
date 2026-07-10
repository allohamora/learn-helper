import '@tanstack/react-start/server-only';
import { z, type ZodType } from 'zod';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type SuccessResponse<T> = {
  success: true;
  data: T;
};

export const successResponseSchema = <T extends ZodType>(dataSchema: T) => {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
};

export type ErrorResponse = {
  success: false;
  error: {
    messages: string[];
    code?: string;
    details?: Record<string, unknown>;
  };
};

export const errorResponseSchema = () => {
  return z.object({
    success: z.literal(false),
    error: z.object({
      messages: z.array(z.string()),
      code: z.string().optional(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
  });
};

export type PageInfo = {
  total: number;
  count: number;
  nextCursor?: string;
};

export type PaginatedResponse<T> = {
  success: true;
  data: T[];
  pageInfo: PageInfo;
};

export const paginatedResponseSchema = <T extends ZodType>(itemSchema: T) => {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    pageInfo: z.object({
      total: z.number(),
      count: z.number(),
      nextCursor: z.string().optional(),
    }),
  });
};

export const response = <S extends ContentfulStatusCode, T extends ZodType>({
  status,
  schema,
  description,
}: {
  status: S;
  schema: T;
  description: string;
}) => {
  return {
    [status]: {
      content: {
        'application/json': {
          schema,
        },
      },
      description,
    },
  } as { [K in S]: { content: { 'application/json': { schema: T } }; description: string } };
};

export const successOkResponse = <T extends ZodType>({ schema, description }: { schema: T; description: string }) => {
  return response({ status: 200, schema: successResponseSchema(schema), description });
};

export const successCreatedResponse = <T extends ZodType>({
  schema,
  description,
}: {
  schema: T;
  description: string;
}) => {
  return response({ status: 201, schema: successResponseSchema(schema), description });
};

export const successPaginatedResponse = <T extends ZodType>({
  schema,
  description,
}: {
  schema: T;
  description: string;
}) => {
  return response({ status: 200, schema: paginatedResponseSchema(schema), description });
};

export const errorBadRequestResponse = ({ description = 'Bad Request' }: { description?: string } = {}) => {
  return response({ status: 400, schema: errorResponseSchema(), description });
};

export const errorUnauthorizedResponse = ({ description = 'Unauthorized' }: { description?: string } = {}) => {
  return response({ status: 401, schema: errorResponseSchema(), description });
};

export const errorForbiddenResponse = ({ description = 'Forbidden' }: { description?: string } = {}) => {
  return response({ status: 403, schema: errorResponseSchema(), description });
};

export const errorNotFoundResponse = ({ description = 'Not Found' }: { description?: string } = {}) => {
  return response({ status: 404, schema: errorResponseSchema(), description });
};

export const errorConflictResponse = ({ description = 'Conflict' }: { description?: string } = {}) => {
  return response({ status: 409, schema: errorResponseSchema(), description });
};

export const errorValidationResponse = ({ description = 'Validation Error' }: { description?: string } = {}) => {
  return response({ status: 422, schema: errorResponseSchema(), description });
};

export const errorInternalServerResponse = ({
  description = 'Internal Server Error',
}: { description?: string } = {}) => {
  return response({ status: 500, schema: errorResponseSchema(), description });
};

// Runtime response helpers for use with c.json()
export const toSuccessResponse = <T, S extends ContentfulStatusCode>({
  status,
  data,
}: {
  status: S;
  data: T;
}): [SuccessResponse<T>, S] => {
  return [{ success: true, data }, status];
};

export const toErrorResponse = <S extends ContentfulStatusCode>({
  status,
  messages,
  code,
  details,
}: {
  status: S;
  messages: string[];
  code?: string;
  details?: Record<string, unknown>;
}): [ErrorResponse, S] => {
  return [{ success: false, error: { messages, code, details } }, status];
};

export const toPaginatedResponse = <T, S extends ContentfulStatusCode>({
  status,
  data: { items, total, nextCursor },
}: {
  status: S;
  data: {
    items: T[];
    total: number;
    nextCursor?: string;
  };
}): [PaginatedResponse<T>, S] => {
  return [{ success: true, data: items, pageInfo: { total, count: items.length, nextCursor } }, status];
};
