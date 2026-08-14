import '@tanstack/react-start/server-only';
import { and, count, desc, eq, lte } from 'drizzle-orm';
import { RequestType } from '@/const/request';
import { file, reading } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { Exception } from '../utils/exception.utils';
import { isUniqueConstraintViolation } from '../utils/db.utils';
import type { ListReadingsFilterDto } from './dtos/list-readings-filter.dto';

export const createFile = async (data: typeof file.$inferInsert, tx: Transaction = db) => {
  try {
    const [created] = await tx.insert(file).values(data).returning();

    return created;
  } catch (err) {
    if (isUniqueConstraintViolation(err, 'file_user_id_hash_idx')) {
      throw Exception.conflict('this file was already uploaded');
    }

    throw err;
  }
};

export const getFileByUserIdAndHash = async (
  { userId, hash }: { userId: string; hash: string },
  tx: Transaction = db,
) => {
  return tx.query.file.findFirst({
    where: and(eq(file.userId, userId), eq(file.hash, hash)),
  });
};

export const createReading = async (data: typeof reading.$inferInsert, tx: Transaction = db) => {
  const [created] = await tx.insert(reading).values(data).returning();

  return created;
};

export const getReadingWithFileByIdAndUserId = async (
  { userId, readingId }: { userId: string; readingId: string },
  tx: Transaction = db,
) => {
  return tx.query.reading.findFirst({
    where: and(eq(reading.id, readingId), eq(reading.userId, userId)),
    with: { file: true },
  });
};

export const deleteFile = async (fileId: string, tx: Transaction = db) => {
  await tx.delete(file).where(eq(file.id, fileId));
};

export const getReadingsByUserId = async (
  { userId, cursor, limit = 20, type = RequestType.All }: ListReadingsFilterDto & { userId: string },
  tx: Transaction = db,
) => {
  const userFilter = eq(reading.userId, userId);
  const cursorFilter = cursor ? lte(reading.id, cursor) : undefined;

  const getItems = async () => {
    const items = await tx.query.reading.findMany({
      where: and(userFilter, cursorFilter),
      orderBy: desc(reading.id),
      limit: limit + 1,
    });

    const nextCursor = items.length > limit ? items.pop()?.id : undefined;

    return { items, nextCursor };
  };

  const getTotal = async () => {
    const [total] = await tx.select({ total: count() }).from(reading).where(userFilter);

    return total;
  };

  if (type === RequestType.Data) {
    const { items, nextCursor } = await getItems();

    return { items, total: 0, nextCursor };
  }

  const [items, total] = await Promise.all([getItems(), getTotal()]);

  return { ...items, ...total };
};
