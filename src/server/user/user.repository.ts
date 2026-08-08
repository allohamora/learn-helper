import '@tanstack/react-start/server-only';
import { eq } from 'drizzle-orm';
import { user } from '../db/db.schema';
import type { Transaction } from '../db/db.types';

export const getUserForUpdate = async (userId: string, tx: Transaction) => {
  const [found] = await tx.select().from(user).where(eq(user.id, userId)).for('update');

  return found;
};
