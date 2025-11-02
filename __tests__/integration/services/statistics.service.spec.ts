import { db, eq, Event, UserWord } from 'astro:db';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getStatistics } from '@/services/statistics.service';
import { Status, TaskType, type UserWord as UserWordMapped } from '@/types/user-words.types';
import { ensureUserWordsExists, getUserWords } from '@/repositories/user-word.repository';
import { EventType } from '@/types/event.types';
import { daysAgo, toDateOnlyString } from '@/utils/date.utils';

describe('statistics.service', () => {
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
    await db.update(UserWord).set({ status: Status.Learning }).where(eq(UserWord.userId, userId));

    userWords = await getUserWords({ userId, limit: 5 }).then(({ data }) => data);
  });

  afterEach(async () => {
    await db.delete(Event).where(eq(Event.userId, userId));
    await db.delete(UserWord).where(eq(UserWord.userId, userId));
  });

  describe('getStatistics', () => {
    it('returns empty statistics when no events exist', async () => {
      const result = await getStatistics({ userId });

      expect(result.general).toEqual({
        totalDiscoveredWords: 0,
        totalMistakesMade: 0,
        totalCompletedTasks: 0,
        totalRetriesCompleted: 0,
        totalShowcasesCompleted: 0,
        totalWordsMovedToNextStep: 0,
        totalLearningDurationMs: 0,
        totalDiscoveringDurationMs: 0,
        averageTimePerTaskMs: 0,
        averageTimePerDiscoveryMs: 0,
      });
      expect(result.discoveringPerDay).toHaveLength(7);
      expect(result.learningPerDay).toHaveLength(7);
      expect(result.topMistakes).toEqual([]);

      for (const day of result.discoveringPerDay) {
        expect(day.learningCount).toBe(0);
        expect(day.knownCount).toBe(0);
        expect(day.durationMs).toBe(0);
      }

      for (const day of result.learningPerDay) {
        expect(day.completedTasks).toBe(0);
        expect(day.completedRetries).toBe(0);
        expect(day.completedShowcases).toBe(0);
        expect(day.mistakesMade).toBe(0);
        expect(day.durationMs).toBe(0);
      }
    });

    it('returns statistics only for the specified user', async () => {
      const otherUserId = randomUUID();
      const userWord = getUserWord();

      await ensureUserWordsExists(otherUserId);
      const [otherUserWord] = await getUserWords({ userId: otherUserId, limit: 1 }).then(({ data }) => data);
      if (!otherUserWord) {
        throw new Error('Failed to create other user word');
      }

      await db.insert(Event).values([
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordDiscovered,
          status: Status.Learning,
          durationMs: 3000,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningTaskCompleted,
          durationMs: 5000,
          taskType: TaskType.WordToDefinition,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToDefinition,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordMovedToNextStep,
        },

        {
          userId: otherUserId,
          userWordId: otherUserWord.id,
          type: EventType.WordDiscovered,
          status: Status.Learning,
        },
        {
          userId: otherUserId,
          userWordId: otherUserWord.id,
          type: EventType.WordDiscovered,
          status: Status.Known,
        },
        {
          userId: otherUserId,
          userWordId: otherUserWord.id,
          type: EventType.RetryLearningTaskCompleted,
          durationMs: 3000,
          taskType: TaskType.DefinitionToWord,
        },
        {
          userId: otherUserId,
          userWordId: otherUserWord.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToTranslation,
        },
        {
          userId: otherUserId,
          userWordId: otherUserWord.id,
          type: EventType.WordMovedToNextStep,
        },
      ]);

      const result = await getStatistics({ userId });

      expect(result.general.totalDiscoveredWords).toBe(1);
      expect(result.general.totalCompletedTasks).toBe(1);
      expect(result.general.totalMistakesMade).toBe(1);
      expect(result.general.totalWordsMovedToNextStep).toBe(1);
      expect(result.general.totalLearningDurationMs).toBe(5000);
      expect(result.general.totalDiscoveringDurationMs).toBe(3000);
      expect(result.general.averageTimePerTaskMs).toBe(5000);
      expect(result.general.averageTimePerDiscoveryMs).toBe(3000);

      expect(result.discoveringPerDay).toHaveLength(7);
      expect(result.discoveringPerDay.at(-1)?.learningCount).toBe(1);

      const totalDiscoveringEvents = result.discoveringPerDay.reduce(
        (sum, day) => sum + day.learningCount + day.knownCount,
        0,
      );
      expect(totalDiscoveringEvents).toBe(1);

      expect(result.learningPerDay).toHaveLength(7);
      expect(result.learningPerDay.at(-1)?.completedTasks).toBe(1);
      expect(result.learningPerDay.at(-1)?.completedRetries).toBe(0);
      expect(result.learningPerDay.at(-1)?.completedShowcases).toBe(0);
      expect(result.learningPerDay.at(-1)?.mistakesMade).toBe(1);
      expect(result.learningPerDay.at(-1)?.durationMs).toBe(5000);

      const totalLearningTasks = result.learningPerDay.reduce(
        (sum, day) => sum + day.completedTasks + day.completedRetries,
        0,
      );
      expect(totalLearningTasks).toBe(1);

      const totalMistakes = result.learningPerDay.reduce((sum, day) => sum + day.mistakesMade, 0);
      expect(totalMistakes).toBe(1);

      const totalDuration = result.learningPerDay.reduce((sum, day) => sum + day.durationMs, 0);
      expect(totalDuration).toBe(5000);

      expect(result.topMistakes).toHaveLength(1);
      expect(result.topMistakes[0]?.count).toBe(1);
      expect(result.topMistakes[0]?.value).toBe(userWord.word.value);
      expect(result.topMistakes[0]?.partOfSpeech).toBe(userWord.word.partOfSpeech);

      await db.delete(Event).where(eq(Event.userId, otherUserId));
      await db.delete(UserWord).where(eq(UserWord.userId, otherUserId));
    });

    it('returns correct general statistics for all event types', async () => {
      const userWord = getUserWord();

      await db.insert(Event).values([
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordDiscovered,
          status: Status.Learning,
          durationMs: 3000,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordDiscovered,
          status: Status.Known,
          durationMs: 2000,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToDefinition,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.DefinitionToWord,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningTaskCompleted,
          durationMs: 5000,
          taskType: TaskType.WordToDefinition,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.ShowcaseTaskCompleted,
          durationMs: 1000,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.ShowcaseTaskCompleted,
          durationMs: 1000,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningTaskCompleted,
          durationMs: 3000,
          taskType: TaskType.DefinitionToWord,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordMovedToNextStep,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordMovedToNextStep,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.RetryLearningTaskCompleted,
          durationMs: 5000,
          taskType: TaskType.WordToTranslation,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.RetryLearningTaskCompleted,
          durationMs: 1000,
          taskType: TaskType.TranslationToWord,
        },
      ]);

      const result = await getStatistics({ userId });
      expect(result.general).toEqual({
        totalDiscoveredWords: 2,
        totalMistakesMade: 2,
        totalCompletedTasks: 2,
        totalRetriesCompleted: 2,
        totalShowcasesCompleted: 2,
        totalWordsMovedToNextStep: 2,
        totalLearningDurationMs: 16000,
        totalDiscoveringDurationMs: 5000,
        averageTimePerTaskMs: 4000,
        averageTimePerDiscoveryMs: 2500,
      });
    });

    it('handles events across the 7-day date range correctly', async () => {
      const userWord = getUserWord();
      const today = new Date();

      const outsideRangeDate = daysAgo(30);

      await db.insert(Event).values([
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordDiscovered,
          status: Status.Learning,
          durationMs: 2000,
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningTaskCompleted,
          durationMs: 5000,
          taskType: TaskType.WordToDefinition,
          createdAt: today,
        },

        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordDiscovered,
          status: Status.Learning,
          durationMs: 1000,
          createdAt: outsideRangeDate,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningTaskCompleted,
          durationMs: 3000,
          taskType: TaskType.DefinitionToWord,
          createdAt: outsideRangeDate,
        },
      ]);

      const result = await getStatistics({ userId });
      expect(result.general.totalDiscoveredWords).toBe(2);
      expect(result.general.totalCompletedTasks).toBe(2);
      expect(result.general.totalLearningDurationMs).toBe(8000);
      expect(result.general.totalDiscoveringDurationMs).toBe(3000);
      expect(result.general.averageTimePerDiscoveryMs).toBe(1500);

      const todayStats = result.discoveringPerDay.find((day) => day.date === toDateOnlyString(today));
      expect(todayStats).toBeDefined();
      expect(todayStats?.learningCount).toBe(1);
      expect(todayStats?.durationMs).toBe(2000);

      const todayLearningStats = result.learningPerDay.find((day) => day.date === toDateOnlyString(today));
      expect(todayLearningStats).toBeDefined();
      expect(todayLearningStats?.completedTasks).toBe(1);
      expect(todayLearningStats?.durationMs).toBe(5000);

      const outsideRangeStats = result.discoveringPerDay.find((day) => day.date === toDateOnlyString(outsideRangeDate));
      expect(outsideRangeStats).toBeUndefined();
    });

    it('returns correct discovering per day statistics within date range', async () => {
      const userWord = getUserWord();
      const today = new Date();
      const yesterday = daysAgo(1);

      await db.insert(Event).values([
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordDiscovered,
          status: Status.Learning,
          durationMs: 2000,
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordDiscovered,
          status: Status.Learning,
          durationMs: 1000,
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordDiscovered,
          status: Status.Known,
          durationMs: 1500,
          createdAt: yesterday,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordDiscovered,
          status: Status.Known,
          durationMs: 500,
          createdAt: yesterday,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordDiscovered,
          status: Status.Learning,
          durationMs: 3000,
          createdAt: yesterday,
        },
      ]);

      const result = await getStatistics({ userId });

      const todayStats = result.discoveringPerDay.find((day) => day.date === toDateOnlyString(today));
      expect(todayStats).toBeDefined();
      expect(todayStats?.learningCount).toBe(2);
      expect(todayStats?.knownCount).toBe(0);
      expect(todayStats?.durationMs).toBe(3000);

      const yesterdayStats = result.discoveringPerDay.find((day) => day.date === toDateOnlyString(yesterday));
      expect(yesterdayStats).toBeDefined();
      expect(yesterdayStats?.learningCount).toBe(1);
      expect(yesterdayStats?.knownCount).toBe(2);
      expect(yesterdayStats?.durationMs).toBe(5000);
    });

    it('returns correct learning per day statistics within date range', async () => {
      const userWord = getUserWord();
      const today = new Date();
      const yesterday = daysAgo(1);

      await db.insert(Event).values([
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningTaskCompleted,
          durationMs: 5000,
          taskType: TaskType.WordToDefinition,
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningTaskCompleted,
          durationMs: 3000,
          taskType: TaskType.DefinitionToWord,
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.RetryLearningTaskCompleted,
          durationMs: 2000,
          taskType: TaskType.WordToTranslation,
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.RetryLearningTaskCompleted,
          durationMs: 1000,
          taskType: TaskType.WordToTranslation,
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.ShowcaseTaskCompleted,
          durationMs: 2000,
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.ShowcaseTaskCompleted,
          durationMs: 1000,
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToDefinition,
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.DefinitionToWord,
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningTaskCompleted,
          durationMs: 4000,
          taskType: TaskType.TranslationToWord,
          createdAt: yesterday,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToTranslation,
          createdAt: yesterday,
        },
      ]);

      const result = await getStatistics({ userId });

      const todayStats = result.learningPerDay.find((day) => day.date === toDateOnlyString(today));
      expect(todayStats).toBeDefined();
      expect(todayStats?.completedTasks).toBe(2);
      expect(todayStats?.completedRetries).toBe(2);
      expect(todayStats?.completedShowcases).toBe(2);
      expect(todayStats?.mistakesMade).toBe(2);
      expect(todayStats?.durationMs).toBe(14000);

      const yesterdayStats = result.learningPerDay.find((day) => day.date === toDateOnlyString(yesterday));
      expect(yesterdayStats).toBeDefined();
      expect(yesterdayStats?.completedTasks).toBe(1);
      expect(yesterdayStats?.completedRetries).toBe(0);
      expect(yesterdayStats?.completedShowcases).toBe(0);
      expect(yesterdayStats?.mistakesMade).toBe(1);
      expect(yesterdayStats?.durationMs).toBe(4000);
    });

    it('returns top mistakes with word details', async () => {
      const userWord1 = getUserWord(0);
      const userWord2 = getUserWord(1);
      const userWord3 = getUserWord(2);

      await db.insert(Event).values([
        {
          userId,
          userWordId: userWord1.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToDefinition,
        },
        {
          userId,
          userWordId: userWord1.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.DefinitionToWord,
        },
        {
          userId,
          userWordId: userWord1.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToTranslation,
        },

        {
          userId,
          userWordId: userWord2.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToDefinition,
        },
        {
          userId,
          userWordId: userWord2.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.DefinitionToWord,
        },

        {
          userId,
          userWordId: userWord3.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToDefinition,
        },
      ]);

      const result = await getStatistics({ userId });

      expect(result.topMistakes).toHaveLength(3);

      expect(result.topMistakes[0]?.count).toBe(3);
      expect(result.topMistakes[0]?.value).toBe(userWord1.word.value);
      expect(result.topMistakes[0]?.partOfSpeech).toBe(userWord1.word.partOfSpeech);

      expect(result.topMistakes[1]?.count).toBe(2);
      expect(result.topMistakes[1]?.value).toBe(userWord2.word.value);
      expect(result.topMistakes[1]?.partOfSpeech).toBe(userWord2.word.partOfSpeech);

      expect(result.topMistakes[2]?.count).toBe(1);
      expect(result.topMistakes[2]?.value).toBe(userWord3.word.value);
      expect(result.topMistakes[2]?.partOfSpeech).toBe(userWord3.word.partOfSpeech);
    });

    it('limits top mistakes to 20 results', async () => {
      const data = await getUserWords({ userId, limit: 60 }).then(({ data }) => data);
      expect(data).toHaveLength(60);

      await Promise.all(
        data.map(
          async (userWord) =>
            await db.insert(Event).values({
              userId,
              userWordId: userWord.id,
              type: EventType.LearningMistakeMade,
              taskType: TaskType.WordToDefinition,
            }),
        ),
      );

      const result = await getStatistics({ userId });
      expect(result.topMistakes).toHaveLength(20);
    });
  });
});
