import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { toErrorResponse } from './response';

export const enum ExceptionCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  BAD_REQUEST = 'BAD_REQUEST',
}

export class Exception extends Error {
  public code: ExceptionCode;
  public payload?: Record<string, unknown>;

  private constructor(code: ExceptionCode, message: string, payload?: Record<string, unknown>) {
    super(message);
    this.name = 'Exception';
    this.code = code;
    this.payload = payload;
  }

  public static validation(errors: z.core.$ZodIssue[]) {
    return new Exception(ExceptionCode.VALIDATION_ERROR, 'Validation failed', { errors });
  }

  public static internalServer(detail?: string) {
    return new Exception(ExceptionCode.INTERNAL_SERVER_ERROR, 'Internal server error', detail ? { detail } : undefined);
  }

  public static notFound(message: string, payload?: Record<string, unknown>) {
    return new Exception(ExceptionCode.NOT_FOUND, message, payload);
  }

  public static unauthorized(message: string, payload?: Record<string, unknown>) {
    return new Exception(ExceptionCode.UNAUTHORIZED, message, payload);
  }

  public static forbidden(message: string, payload?: Record<string, unknown>) {
    return new Exception(ExceptionCode.FORBIDDEN, message, payload);
  }

  public static conflict(message: string, payload?: Record<string, unknown>) {
    return new Exception(ExceptionCode.CONFLICT, message, payload);
  }

  public static badRequest(message: string, payload?: Record<string, unknown>) {
    return new Exception(ExceptionCode.BAD_REQUEST, message, payload);
  }

  private toHttpCode(): ContentfulStatusCode {
    switch (this.code) {
      case ExceptionCode.BAD_REQUEST:
        return 400;
      case ExceptionCode.UNAUTHORIZED:
        return 401;
      case ExceptionCode.FORBIDDEN:
        return 403;
      case ExceptionCode.NOT_FOUND:
        return 404;
      case ExceptionCode.CONFLICT:
        return 409;
      case ExceptionCode.VALIDATION_ERROR:
        return 422;
      case ExceptionCode.INTERNAL_SERVER_ERROR:
        return 500;
    }
  }

  public toHttpData() {
    return {
      status: this.toHttpCode(),
      body: {
        success: false as const,
        error: {
          messages: [this.message],
          code: this.code,
          ...(this.payload && { details: this.payload }),
        },
      },
    };
  }

  public toHttpResponse() {
    return toErrorResponse({
      status: this.toHttpCode(),
      messages: [this.message],
      code: this.code,
      details: this.payload,
    });
  }
}
