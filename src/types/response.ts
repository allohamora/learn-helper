export type SuccessResponse<T> = {
  success: true;
  data: T;
};

export type ErrorResponse = {
  success: false;
  error: {
    messages: string[];
    code?: string;
    details?: Record<string, unknown>;
  };
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
