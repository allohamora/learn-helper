import { db, UserWord, eq, sql, Word, and, asc, gte } from 'astro:db';

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

type GetUserWordsBody = {
  userId: string;
  level?: 'a1' | 'a2' | 'b1' | 'b2' | 'c1';
  list?: 'oxford-5000-words' | 'oxford-phrase-list';
  cursor?: string;
  limit: number;
};

export const getUserWords = async ({ userId, level, list, cursor, limit }: GetUserWordsBody) => {
  const filters = [
    eq(UserWord.userId, userId),
    level ? eq(Word.level, level) : undefined,
    list ? eq(Word.list, list) : undefined,
  ];

  const getTotal = async () => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(UserWord)
      .where(and(...filters));

    return count;
  };

  const getLearning = async () => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(UserWord)
      .where(and(...filters, eq(UserWord.status, 'learning')));

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
