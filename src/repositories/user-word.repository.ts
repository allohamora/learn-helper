import type { AuthParams } from '@/types/auth.types';
import { Level, List, Status } from '@/types/user-words.types';
import { db, UserWord, eq, sql, Word, and, asc, gte, inArray } from 'astro:db';

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

type GetUserWordsBody = AuthParams<{
  level?: Level;
  list?: List;
  status?: Status;
  cursor?: string;
  limit: number;
}>;

export const getUserWords = async ({ userId, level, list, status, cursor, limit }: GetUserWordsBody) => {
  const filters = [
    eq(UserWord.userId, userId),
    level ? eq(Word.level, level) : undefined,
    list ? eq(Word.list, list) : undefined,
    status ? eq(UserWord.status, status) : undefined,
  ];

  const getTotal = async () => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(UserWord)
      .where(and(...filters))
      .leftJoin(Word, eq(UserWord.wordId, Word.id));

    return count;
  };

  const getLearning = async () => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(UserWord)
      .where(and(...filters, inArray(UserWord.status, [Status.Learning, Status.Waiting])))
      .leftJoin(Word, eq(UserWord.wordId, Word.id));

    return count;
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
    const data = result.slice(0, limit).map((item) => ({
      ...item.Word,
      ...item.UserWord,
    }));

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
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(UserWord)
      .where(and(...filters))
      .leftJoin(Word, eq(UserWord.wordId, Word.id));

    return count;
  };

  const getData = async () => {
    const result = await db
      .select()
      .from(UserWord)
      .where(and(...filters))
      .leftJoin(Word, eq(UserWord.wordId, Word.id))
      .orderBy(asc(UserWord.id))
      .limit(limit);

    return result.map((item) => ({
      ...item.Word,
      ...item.UserWord,
    }));
  };

  const [total, data] = await Promise.all([getTotal(), getData()]);

  return {
    total,
    data,
  };
};

export const getLearningWords = async ({ userId, limit = 5 }: AuthParams<{ limit?: number }>) => {
  const result = await db
    .select()
    .from(UserWord)
    .where(and(eq(UserWord.userId, userId), eq(UserWord.status, Status.Learning)))
    .leftJoin(Word, eq(UserWord.wordId, Word.id))
    .orderBy(asc(UserWord.id))
    .limit(limit);

  return {
    words: result.map((item) => ({
      ...item.Word,
      ...item.UserWord,
    })),
  };
};

export const updateUserWordStatus = async ({
  userId,
  status,
  userWordId,
}: AuthParams<{ status: Status; userWordId: number }>) => {
  await db
    .update(UserWord)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(UserWord.userId, userId), eq(UserWord.id, userWordId)));
};
