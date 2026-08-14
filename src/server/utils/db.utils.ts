import '@tanstack/react-start/server-only';
import postgres from 'postgres';
import { DrizzleQueryError } from 'drizzle-orm';

export const isUniqueConstraintViolation = (err: unknown, constraintName: string) => {
  const cause = err instanceof DrizzleQueryError ? err.cause : err;

  return cause instanceof postgres.PostgresError && cause.constraint_name === constraintName;
};
