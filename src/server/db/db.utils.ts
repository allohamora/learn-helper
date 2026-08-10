import '@tanstack/react-start/server-only';
import { count } from 'drizzle-orm';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { db } from './db.service';

export const countItems = async (table: AnyPgTable) => {
  const [row] = await db.select({ value: count() }).from(table);

  return row?.value ?? 0;
};

export const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, '\\$&');
