import '@tanstack/react-start/server-only';
import { file, reading } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';

export const createFile = async (data: typeof file.$inferInsert, tx: Transaction = db) => {
  const [created] = await tx.insert(file).values(data).returning();

  return created;
};

export const createReading = async (data: typeof reading.$inferInsert, tx: Transaction = db) => {
  const [created] = await tx.insert(reading).values(data).returning();

  return created;
};
