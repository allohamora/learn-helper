import type { AuthParams } from '@/types/auth.types';
import type { Transaction } from '@/types/db.types';
import { Level, List, Status } from '@/types/user-words.types';
import { db, UserWord, eq, sql, Word, and, asc, gte, inArray, desc, like } from 'astro:db';

const isUserWordsExists = async (userId: string) => {
  const res = await db.select().from(UserWord).where(eq(UserWord.userId, userId)).limit(1);

  return !!res.length;
};

const createUserWords = async (userId: string) => {
  await db.run(
    sql`INSERT INTO ${UserWord} (wordId, userId) SELECT ${Word.id}, ${sql<string>`${userId}`} FROM ${Word} ORDER BY ${Word.id} ASC`,
  );
};

export const ensureUserWordsExists = async (userId: string) => {
  const isExists = await isUserWordsExists(userId);

  if (!isExists) {
    await createUserWords(userId);
  }
};

const mapUserWords = (rows: { UserWord: typeof UserWord.$inferSelect; Word: typeof Word.$inferSelect | null }[]) => {
  return rows.map((row) => {
    if (!row.Word) {
      throw new Error('Word not found for UserWord');
    }

    return {
      word: row.Word,
      ...row.UserWord,
    };
  });
};

type GetUserWordsBody = AuthParams<{
  level?: Level;
  list?: List;
  status?: Status;
  search?: string;
  cursor?: string;
  limit: number;
}>;

export const getUserWords = async ({ userId, level, list, status, search, cursor, limit }: GetUserWordsBody) => {
  const filters = [
    eq(UserWord.userId, userId),
    level ? eq(Word.level, level) : undefined,
    list ? eq(Word.list, list) : undefined,
    status ? eq(UserWord.status, status) : undefined,
    search ? like(Word.value, `%${search}%`) : undefined,
  ];

  const getTotal = async () => {
    const [res] = await db
      .select({ count: sql<number>`count(*)` })
      .from(UserWord)
      .where(and(...filters))
      .leftJoin(Word, eq(UserWord.wordId, Word.id));

    if (!res) {
      throw new Error('Failed to get total count');
    }

    return res.count;
  };

  const getLearning = async () => {
    const [res] = await db
      .select({ count: sql<number>`count(*)` })
      .from(UserWord)
      .where(and(...filters, inArray(UserWord.status, [Status.Learning, Status.Waiting])))
      .leftJoin(Word, eq(UserWord.wordId, Word.id));

    if (!res) {
      throw new Error('Failed to get learning count');
    }

    return res.count;
  };

  const getData = async () => {
    const result = await db
      .select()
      .from(UserWord)
      .where(and(...filters, cursor ? gte(UserWord.id, Number(cursor)) : undefined))
      .leftJoin(Word, eq(UserWord.wordId, Word.id))
      .orderBy(asc(UserWord.id))
      .limit(limit + 1);

    const nextCursor = result.length > limit ? String(result.at(-1)?.UserWord.id) : undefined;
    const data = mapUserWords(result.slice(0, limit));

    return { data, nextCursor };
  };

  const [total, learning, data] = await Promise.all([getTotal(), getLearning(), getData()]);

  return {
    total,
    learning,
    ...data,
  };
};

export const getWaitingWords = async ({ userId, limit }: AuthParams<{ limit: number }>) => {
  const filters = [eq(UserWord.userId, userId), eq(UserWord.status, Status.Waiting)];

  const getTotal = async () => {
    const [res] = await db
      .select({ count: sql<number>`count(*)` })
      .from(UserWord)
      .where(and(...filters))
      .leftJoin(Word, eq(UserWord.wordId, Word.id));

    if (!res) {
      throw new Error('Failed to get total count');
    }

    return res.count;
  };

  const getData = async () => {
    const result = await db
      .select()
      .from(UserWord)
      .where(and(...filters))
      .leftJoin(Word, eq(UserWord.wordId, Word.id))
      .orderBy(asc(UserWord.id))
      .limit(limit);

    return mapUserWords(result);
  };

  const [total, data] = await Promise.all([getTotal(), getData()]);

  return {
    total,
    data,
  };
};

export const getLearningWords = async ({ userId, limit }: AuthParams<{ limit: number }>) => {
  const result = await db
    .select()
    .from(UserWord)
    .where(and(eq(UserWord.userId, userId), eq(UserWord.status, Status.Learning)))
    .leftJoin(Word, eq(UserWord.wordId, Word.id))
    .orderBy(asc(UserWord.wordsToUnlock), asc(UserWord.id))
    .limit(limit);

  return mapUserWords(result);
};

export const updateUserWordStatus = async (
  { userId, userWordId, status }: AuthParams<{ userWordId: number; status: Status }>,
  tx: Transaction = db,
) => {
  await tx
    .update(UserWord)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(UserWord.id, userWordId), eq(UserWord.userId, userId)));
};

export const getUserWordById = async ({ userWordId }: { userWordId: number }, tx: Transaction = db) => {
  const result = await tx
    .select()
    .from(UserWord)
    .where(eq(UserWord.id, userWordId))
    .leftJoin(Word, eq(UserWord.wordId, Word.id))
    .limit(1);

  if (!result.length || !result[0]?.Word) {
    throw new Error('UserWord is not found');
  }

  return {
    word: result[0].Word,
    ...result[0].UserWord,
  };
};

export const updateUserWord = async (
  { userWordId, ...data }: { userWordId: number } & Partial<typeof UserWord.$inferSelect>,
  tx: Transaction = db,
) => {
  await tx
    .update(UserWord)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(UserWord.id, userWordId)));
};

export const getMaxWordsToUnlock = async ({ userId }: AuthParams, tx: Transaction = db) => {
  const [res] = await tx
    .select({ wordsToUnlock: UserWord.wordsToUnlock })
    .from(UserWord)
    .where(eq(UserWord.userId, userId))
    .orderBy(desc(UserWord.wordsToUnlock))
    .limit(1);

  if (!res) {
    throw new Error('Failed to get max words to unlock');
  }

  return res.wordsToUnlock;
};

export const decreaseMaxWordsToUnlock = async ({ userId }: AuthParams, tx: Transaction = db) => {
  await tx
    .update(UserWord)
    .set({ wordsToUnlock: sql`${UserWord.wordsToUnlock} - 1`, updatedAt: new Date() })
    .where(and(eq(UserWord.userId, userId), gte(UserWord.wordsToUnlock, 1)));
};
