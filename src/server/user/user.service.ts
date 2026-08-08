import '@tanstack/react-start/server-only';
import { Exception } from '../utils/exception.utils';
import { getUserForUpdate } from './user.repository';
import type { Transaction } from '../db/db.types';

export const getUserForUpdateOrThrow = async (userId: string, tx: Transaction) => {
  const user = await getUserForUpdate(userId, tx);
  if (!user) throw Exception.notFound(`user "${userId}" not found`);

  return user;
};
