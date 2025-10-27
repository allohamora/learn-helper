import { db, eq, Event, UserWord } from 'astro:db';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getStatistics } from '@/services/event.service';
import { EventType, Status, TaskType, type UserWord as UserWordMapped } from '@/types/user-words.types';
import { ensureUserWordsExists, getUserWords } from '@/repositories/user-word.repository';

describe('event.service', () => {
  const userId = randomUUID();

  let userWords: UserWordMapped[];

  const getUserWord = (idx: number = 0) => {
    const userWord = userWords[idx];
    if (!userWord) {
      throw new Error('Failed to get test userWord');
    }

    return userWord;
  };

  beforeEach(async () => {
    await ensureUserWordsExists(userId);
    await db.update(UserWord).set({ status: Status.Learning });

    userWords = await getUserWords({ userId, limit: 5 }).then(({ data }) => data);
  });

  afterEach(async () => {
    await db.delete(Event).where(eq(Event.userId, userId));
    await db.delete(UserWord).where(eq(UserWord.userId, userId));
  });

  describe('getStatistics', () => {
    it('returns empty statistics when no events exist', async () => {
      const dateFrom = new Date('2025-01-01');
      const dateTo = new Date('2025-01-31');

      const result = await getStatistics({ userId, dateFrom, dateTo });

      expect(result.typeStatistics).toEqual([]);
      expect(result.durationStatistics).toEqual([]);
      expect(result.discoveryStatistics).toEqual([]);
      expect(result.topMistakes).toEqual([]);
    });

    it('returns type statistics grouped by event type', async () => {
      const dateFrom = new Date('2025-01-01');
      const dateTo = new Date('2025-01-31');
      const createdAt = new Date('2025-01-15');

      const userWord = getUserWord();

      await db.insert(Event).values([
        {
          userId,
          type: EventType.LearningSessionCompleted,
          data: { duration: 5000, totalTasks: 10, totalMistakes: 2 },
          createdAt,
        },
        {
          userId,
          type: EventType.LearningSessionCompleted,
          data: { duration: 3000, totalTasks: 8, totalMistakes: 1 },
          createdAt,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          data: { type: TaskType.WordToDefinition },
          createdAt,
        },
      ]);

      const result = await getStatistics({ userId, dateFrom, dateTo });

      expect(result.typeStatistics).toHaveLength(2);
      expect(result.typeStatistics).toContainEqual({
        type: EventType.LearningSessionCompleted,
        count: 2,
      });
      expect(result.typeStatistics).toContainEqual({
        type: EventType.LearningMistakeMade,
        count: 1,
      });
    });

    it('returns duration statistics grouped by date', async () => {
      const dateFrom = new Date('2025-01-01');
      const dateTo = new Date('2025-01-31');

      await db.insert(Event).values([
        {
          userId,
          type: EventType.LearningSessionCompleted,
          data: { duration: 5000, totalTasks: 10, totalMistakes: 2 },
          createdAt: new Date('2025-01-15T10:00:00Z'),
        },
        {
          userId,
          type: EventType.LearningSessionCompleted,
          data: { duration: 3000, totalTasks: 8, totalMistakes: 1 },
          createdAt: new Date('2025-01-15T14:00:00Z'),
        },
        {
          userId,
          type: EventType.LearningSessionCompleted,
          data: { duration: 4000, totalTasks: 5, totalMistakes: 0 },
          createdAt: new Date('2025-01-16T10:00:00Z'),
        },
      ]);

      const result = await getStatistics({ userId, dateFrom, dateTo });

      expect(result.durationStatistics).toHaveLength(2);

      const jan15Stats = result.durationStatistics.find((s) => s.date === '2025-01-15');
      expect(jan15Stats).toBeDefined();
      expect(jan15Stats?.count).toBe(2);
      expect(jan15Stats?.duration).toBe(8000);

      const jan16Stats = result.durationStatistics.find((s) => s.date === '2025-01-16');
      expect(jan16Stats).toBeDefined();
      expect(jan16Stats?.count).toBe(1);
      expect(jan16Stats?.duration).toBe(4000);
    });

    it('returns discovery statistics grouped by status', async () => {
      const dateFrom = new Date('2025-01-01');
      const dateTo = new Date('2025-01-31');
      const createdAt = new Date('2025-01-15');

      const userWord = getUserWord();

      await db.insert(Event).values([
        {
          userId,
          userWordId: userWord.id,
          type: EventType.DiscoveryWordStatusChanged,
          data: { status: Status.Learning },
          createdAt,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.DiscoveryWordStatusChanged,
          data: { status: Status.Learning },
          createdAt,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.DiscoveryWordStatusChanged,
          data: { status: Status.Known },
          createdAt,
        },
      ]);

      const result = await getStatistics({ userId, dateFrom, dateTo });

      expect(result.discoveryStatistics).toHaveLength(2);
      expect(result.discoveryStatistics).toContainEqual({
        status: Status.Learning,
        count: 2,
      });
      expect(result.discoveryStatistics).toContainEqual({
        status: Status.Known,
        count: 1,
      });
    });

    it('returns top mistakes with word details', async () => {
      const dateFrom = new Date('2025-01-01');
      const dateTo = new Date('2025-01-31');
      const createdAt = new Date('2025-01-15');

      const userWord = getUserWord(0);
      const userWord2 = getUserWord(1);

      await db.insert(Event).values([
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          data: { type: TaskType.WordToDefinition },
          createdAt,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          data: { type: TaskType.DefinitionToWord },
          createdAt,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          data: { type: TaskType.WordToTranslation },
          createdAt,
        },
        {
          userId,
          userWordId: userWord2.id,
          type: EventType.LearningMistakeMade,
          data: { type: TaskType.WordToDefinition },
          createdAt,
        },
      ]);

      const result = await getStatistics({ userId, dateFrom, dateTo });

      expect(result.topMistakes).toHaveLength(2);

      const testWordMistakes = result.topMistakes.find((m) => m.value === userWord.word.value);
      expect(testWordMistakes).toBeDefined();
      expect(testWordMistakes?.count).toBe(3);
      expect(testWordMistakes?.partOfSpeech).toBe(userWord.word.partOfSpeech);

      const exampleWordMistakes = result.topMistakes.find((m) => m.value === userWord2.word.value);
      expect(exampleWordMistakes).toBeDefined();
      expect(exampleWordMistakes?.count).toBe(1);
      expect(exampleWordMistakes?.partOfSpeech).toBe(userWord2.word.partOfSpeech);
    });

    it('filters events by date range correctly', async () => {
      const dateFrom = new Date('2025-01-15');
      const dateTo = new Date('2025-01-20');

      await db.insert(Event).values([
        {
          userId,
          type: EventType.LearningSessionCompleted,
          data: { duration: 5000, totalTasks: 10, totalMistakes: 2 },
          createdAt: new Date('2025-01-14'), // Before range
        },
        {
          userId,
          type: EventType.LearningSessionCompleted,
          data: { duration: 3000, totalTasks: 8, totalMistakes: 1 },
          createdAt: new Date('2025-01-16'), // Within range
        },
        {
          userId,
          type: EventType.LearningSessionCompleted,
          data: { duration: 4000, totalTasks: 5, totalMistakes: 0 },
          createdAt: new Date('2025-01-21'), // After range
        },
      ]);

      const result = await getStatistics({ userId, dateFrom, dateTo });

      expect(result.typeStatistics).toHaveLength(1);
      expect(result.typeStatistics.at(0)?.count).toBe(1);
      expect(result.durationStatistics).toHaveLength(1);
      expect(result.durationStatistics.at(0)?.duration).toBe(3000);
    });

    it('only returns statistics for the specified user', async () => {
      const otherUserId = randomUUID();
      const dateFrom = new Date('2025-01-01');
      const dateTo = new Date('2025-01-31');
      const createdAt = new Date('2025-01-15');

      await db.insert(Event).values([
        {
          userId,
          type: EventType.LearningSessionCompleted,
          data: { duration: 5000, totalTasks: 10, totalMistakes: 2 },
          createdAt,
        },
        {
          userId: otherUserId,
          type: EventType.LearningSessionCompleted,
          data: { duration: 3000, totalTasks: 8, totalMistakes: 1 },
          createdAt,
        },
      ]);

      const result = await getStatistics({ userId, dateFrom, dateTo });

      expect(result.typeStatistics).toHaveLength(1);
      expect(result.typeStatistics.at(0)?.count).toBe(1);
    });

    it('handles all event types in parallel execution correctly', async () => {
      const dateFrom = new Date('2025-01-01');
      const dateTo = new Date('2025-01-31');
      const createdAt = new Date('2025-01-15');

      const userWord = getUserWord();

      await db.insert(Event).values([
        {
          userId,
          type: EventType.LearningSessionCompleted,
          data: { duration: 5000, totalTasks: 10, totalMistakes: 2 },
          createdAt,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.DiscoveryWordStatusChanged,
          data: { status: Status.Learning },
          createdAt,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          data: { type: TaskType.WordToDefinition },
          createdAt,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordMovedToNextStep,
          createdAt,
        },
      ]);

      const result = await getStatistics({ userId, dateFrom, dateTo });

      expect(result.typeStatistics).toBeDefined();
      expect(result.durationStatistics).toBeDefined();
      expect(result.discoveryStatistics).toBeDefined();
      expect(result.topMistakes).toBeDefined();

      expect(result.typeStatistics.length).toBeGreaterThan(0);
      expect(result.discoveryStatistics.length).toBeGreaterThan(0);
      expect(result.topMistakes.length).toBeGreaterThan(0);
    });
  });
});
