import '@tanstack/react-start/server-only';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { toErrorResponse } from './response.utils';

export const enum ExceptionCode {
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  BAD_REQUEST = 'BAD_REQUEST',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
}

type ExceptionOptions = { cause?: unknown; [key: string]: unknown };

export class Exception extends Error {
  public code: ExceptionCode;
  public payload?: Record<string, unknown>;

  private constructor(code: ExceptionCode, message: string, { cause, ...payload }: ExceptionOptions = {}) {
    super(message, { cause });
    this.name = 'Exception';
    this.code = code;
    this.payload = Object.keys(payload).length ? payload : undefined;
  }

  public static internalServer(message: string, options?: ExceptionOptions) {
    return new Exception(ExceptionCode.INTERNAL_SERVER_ERROR, message, options);
  }

  public static notFound(message: string, options?: ExceptionOptions) {
    return new Exception(ExceptionCode.NOT_FOUND, message, options);
  }

  public static unauthorized(message: string, options?: ExceptionOptions) {
    return new Exception(ExceptionCode.UNAUTHORIZED, message, options);
  }

  public static forbidden(message: string, options?: ExceptionOptions) {
    return new Exception(ExceptionCode.FORBIDDEN, message, options);
  }

  public static conflict(message: string, options?: ExceptionOptions) {
    return new Exception(ExceptionCode.CONFLICT, message, options);
  }

  public static badRequest(message: string, options?: ExceptionOptions) {
    return new Exception(ExceptionCode.BAD_REQUEST, message, options);
  }

  public static tooManyRequests(message = 'Too many requests, please try again later.', options?: ExceptionOptions) {
    return new Exception(ExceptionCode.TOO_MANY_REQUESTS, message, options);
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
      case ExceptionCode.TOO_MANY_REQUESTS:
        return 429;
      case ExceptionCode.INTERNAL_SERVER_ERROR:
        return 500;
      default:
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
