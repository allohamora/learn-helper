import { db, eq, Event, UserWord } from 'astro:db';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getStatistics } from '@/services/statistics.service';
import { Status, TaskType, type UserWord as UserWordMapped } from '@/types/user-words.types';
import { ensureUserWordsExists, getUserWords } from '@/repositories/user-word.repository';
import { EventType } from '@/types/event.types';
import { daysAgo, endOfDay, startOfDay, toDateOnlyString } from '@/utils/date.utils';

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
        totalHintsViewed: 0,
        totalTaskCostsInNanoDollars: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalLearningDurationMs: 0,
        totalDiscoveringDurationMs: 0,
        averageTimePerTaskMs: 0,
        averageTimePerDiscoveryMs: 0,
      });
      expect(result.discoveringPerDay).toHaveLength(7);
      expect(result.learningPerDay).toHaveLength(7);
      expect(result.costPerDay).toHaveLength(7);
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
        expect(day.hintsViewed).toBe(0);
        expect(day.durationMs).toBe(0);
      }

      for (const day of result.costPerDay) {
        expect(day.costInNanoDollars).toBe(0);
        expect(day.inputTokens).toBe(0);
        expect(day.outputTokens).toBe(0);
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
          userId,
          type: EventType.TaskCost,
          taskType: TaskType.WordToDefinition,
          userWordIds: [userWord.id],
          costInNanoDollars: 5_000_000_000,
          inputTokens: 1000,
          outputTokens: 2000,
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
        {
          userId: otherUserId,
          type: EventType.TaskCost,
          taskType: TaskType.WordToTranslation,
          userWordIds: [otherUserWord.id],
          costInNanoDollars: 10_000_000_000,
          inputTokens: 2000,
          outputTokens: 4000,
        },
      ]);

      const result = await getStatistics({ userId });

      expect(result.general.totalDiscoveredWords).toBe(1);
      expect(result.general.totalCompletedTasks).toBe(1);
      expect(result.general.totalMistakesMade).toBe(1);
      expect(result.general.totalWordsMovedToNextStep).toBe(1);
      expect(result.general.totalTaskCostsInNanoDollars).toBe(5_000_000_000);
      expect(result.general.totalInputTokens).toBe(1000);
      expect(result.general.totalOutputTokens).toBe(2000);
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

      const totalCost = result.costPerDay.reduce((sum, day) => sum + day.costInNanoDollars, 0);
      expect(totalCost).toBe(5_000_000_000);

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
        {
          userId,
          type: EventType.TaskCost,
          taskType: TaskType.WordToDefinition,
          userWordIds: [userWord.id],
          costInNanoDollars: 3_500_000_000,
          inputTokens: 1500,
          outputTokens: 3000,
        },
        {
          userId,
          type: EventType.TaskCost,
          taskType: TaskType.DefinitionToWord,
          userWordIds: [userWord.id],
          costInNanoDollars: 1_500_000_000,
          inputTokens: 500,
          outputTokens: 1000,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.HintViewed,
          taskType: TaskType.WordToDefinition,
          hint: 'Test hint 1',
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.HintViewed,
          taskType: TaskType.DefinitionToWord,
          hint: 'Test hint 2',
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.HintViewed,
          taskType: TaskType.WordToTranslation,
          hint: 'Test hint 3',
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
        totalHintsViewed: 3,
        totalTaskCostsInNanoDollars: 5_000_000_000,
        totalInputTokens: 2000,
        totalOutputTokens: 4000,
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
          type: EventType.TaskCost,
          taskType: TaskType.WordToDefinition,
          userWordIds: [userWord.id],
          costInNanoDollars: 1_000_000,
          inputTokens: 100,
          outputTokens: 200,
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
        {
          userId,
          type: EventType.TaskCost,
          taskType: TaskType.WordToDefinition,
          userWordIds: [userWord.id],
          costInNanoDollars: 2_000_000,
          inputTokens: 200,
          outputTokens: 400,
          createdAt: outsideRangeDate,
        },
      ]);

      const result = await getStatistics({ userId });
      expect(result.general.totalDiscoveredWords).toBe(2);
      expect(result.general.totalCompletedTasks).toBe(2);
      expect(result.general.totalLearningDurationMs).toBe(8000);
      expect(result.general.totalDiscoveringDurationMs).toBe(3000);
      expect(result.general.averageTimePerDiscoveryMs).toBe(1500);
      expect(result.general.totalTaskCostsInNanoDollars).toBe(3_000_000);
      expect(result.general.totalInputTokens).toBe(300);
      expect(result.general.totalOutputTokens).toBe(600);

      const todayStats = result.discoveringPerDay.find((day) => day.date === toDateOnlyString(today));
      expect(todayStats).toBeDefined();
      expect(todayStats?.learningCount).toBe(1);
      expect(todayStats?.durationMs).toBe(2000);

      const todayLearningStats = result.learningPerDay.find((day) => day.date === toDateOnlyString(today));
      expect(todayLearningStats).toBeDefined();
      expect(todayLearningStats?.completedTasks).toBe(1);
      expect(todayLearningStats?.durationMs).toBe(5000);

      const todayCostStats = result.costPerDay.find((day) => day.date === toDateOnlyString(today));
      expect(todayCostStats).toBeDefined();
      expect(todayCostStats?.costInNanoDollars).toBe(1_000_000);
      expect(todayCostStats?.inputTokens).toBe(100);
      expect(todayCostStats?.outputTokens).toBe(200);

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
      expect(result.costPerDay.find((day) => day.date === toDateOnlyString(today))?.costInNanoDollars).toBe(0);
      expect(result.costPerDay.find((day) => day.date === toDateOnlyString(today))?.inputTokens).toBe(0);
      expect(result.costPerDay.find((day) => day.date === toDateOnlyString(today))?.outputTokens).toBe(0);

      const yesterdayStats = result.discoveringPerDay.find((day) => day.date === toDateOnlyString(yesterday));
      expect(yesterdayStats).toBeDefined();
      expect(yesterdayStats?.learningCount).toBe(1);
      expect(yesterdayStats?.knownCount).toBe(2);
      expect(yesterdayStats?.durationMs).toBe(5000);
      expect(result.costPerDay.find((day) => day.date === toDateOnlyString(yesterday))?.costInNanoDollars).toBe(0);
      expect(result.costPerDay.find((day) => day.date === toDateOnlyString(yesterday))?.inputTokens).toBe(0);
      expect(result.costPerDay.find((day) => day.date === toDateOnlyString(yesterday))?.outputTokens).toBe(0);
    });

    it('returns correct learning per day statistics within date range', async () => {
      const userWord = getUserWord();
      const today = new Date();
      const weekAgo = daysAgo(6);

      await db.insert(Event).values([
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
          type: EventType.LearningTaskCompleted,
          durationMs: 3000,
          taskType: TaskType.DefinitionToWord,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.RetryLearningTaskCompleted,
          durationMs: 2000,
          taskType: TaskType.WordToTranslation,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.RetryLearningTaskCompleted,
          durationMs: 1000,
          taskType: TaskType.WordToTranslation,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.ShowcaseTaskCompleted,
          durationMs: 2000,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.ShowcaseTaskCompleted,
          durationMs: 1000,
          createdAt: startOfDay(today),
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
          createdAt: endOfDay(today),
        },

        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningTaskCompleted,
          durationMs: 4000,
          taskType: TaskType.TranslationToWord,
          createdAt: startOfDay(weekAgo),
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToTranslation,
          createdAt: weekAgo,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToTranslation,
          createdAt: endOfDay(weekAgo),
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

      const weekAgoStats = result.learningPerDay.find((day) => day.date === toDateOnlyString(weekAgo));
      expect(weekAgoStats).toBeDefined();
      expect(weekAgoStats?.completedTasks).toBe(1);
      expect(weekAgoStats?.completedRetries).toBe(0);
      expect(weekAgoStats?.completedShowcases).toBe(0);
      expect(weekAgoStats?.mistakesMade).toBe(2);
      expect(weekAgoStats?.durationMs).toBe(4000);
    });

    it('returns correct task cost per day statistics within date range', async () => {
      const userWord = getUserWord();
      const today = new Date();
      const weekAgo = daysAgo(6);
      const outsideRangeDate = daysAgo(10);

      await db.insert(Event).values([
        {
          userId,
          type: EventType.TaskCost,
          taskType: TaskType.WordToDefinition,
          userWordIds: [userWord.id],
          costInNanoDollars: 2_000_000_000,
          inputTokens: 2000,
          outputTokens: 4000,
          createdAt: today,
        },
        {
          userId,
          type: EventType.TaskCost,
          taskType: TaskType.DefinitionToWord,
          userWordIds: [userWord.id],
          costInNanoDollars: 4_000_000_000,
          inputTokens: 4000,
          outputTokens: 8000,
          createdAt: today,
        },
        {
          userId,
          type: EventType.TaskCost,
          taskType: TaskType.WordToTranslation,
          userWordIds: [userWord.id],
          costInNanoDollars: 1_500_000_000,
          inputTokens: 1500,
          outputTokens: 3000,
          createdAt: weekAgo,
        },
        {
          userId,
          type: EventType.TaskCost,
          taskType: TaskType.TranslationToWord,
          userWordIds: [userWord.id],
          costInNanoDollars: 1_000_000_000,
          inputTokens: 1000,
          outputTokens: 2000,
          createdAt: outsideRangeDate,
        },
      ]);

      const result = await getStatistics({ userId });

      const todayStats = result.costPerDay.find((day) => day.date === toDateOnlyString(today));
      expect(todayStats).toBeDefined();
      expect(todayStats?.costInNanoDollars).toBe(6_000_000_000);
      expect(todayStats?.inputTokens).toBe(6000);
      expect(todayStats?.outputTokens).toBe(12000);

      const weekAgoStats = result.costPerDay.find((day) => day.date === toDateOnlyString(weekAgo));
      expect(weekAgoStats).toBeDefined();
      expect(weekAgoStats?.costInNanoDollars).toBe(1_500_000_000);
      expect(weekAgoStats?.inputTokens).toBe(1500);
      expect(weekAgoStats?.outputTokens).toBe(3000);

      const outsideRangeStats = result.costPerDay.find((day) => day.date === toDateOnlyString(outsideRangeDate));
      expect(outsideRangeStats).toBeUndefined();
    });

    it('returns top mistakes with word details', async () => {
      const userWord1 = getUserWord(0);
      const userWord2 = getUserWord(1);
      const userWord3 = getUserWord(2);
      const userWord4 = getUserWord(3);

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

        {
          userId,
          userWordId: userWord4.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToDefinition,
        },
        {
          userId,
          userWordId: userWord4.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToDefinition,
        },
        {
          userId,
          userWordId: userWord4.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToDefinition,
        },
        {
          userId,
          userWordId: userWord4.id,
          type: EventType.LearningMistakeMade,
          taskType: TaskType.WordToDefinition,
        },
      ]);

      const result = await getStatistics({ userId });

      expect(result.topMistakes).toHaveLength(4);

      expect(result.topMistakes[0]?.count).toBe(4);
      expect(result.topMistakes[0]?.value).toBe(userWord4.word.value);
      expect(result.topMistakes[0]?.partOfSpeech).toBe(userWord4.word.partOfSpeech);

      expect(result.topMistakes[1]?.count).toBe(3);
      expect(result.topMistakes[1]?.value).toBe(userWord1.word.value);
      expect(result.topMistakes[1]?.partOfSpeech).toBe(userWord1.word.partOfSpeech);

      expect(result.topMistakes[2]?.count).toBe(2);
      expect(result.topMistakes[2]?.value).toBe(userWord2.word.value);
      expect(result.topMistakes[2]?.partOfSpeech).toBe(userWord2.word.partOfSpeech);

      expect(result.topMistakes[3]?.count).toBe(1);
      expect(result.topMistakes[3]?.value).toBe(userWord3.word.value);
      expect(result.topMistakes[3]?.partOfSpeech).toBe(userWord3.word.partOfSpeech);
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

    it('counts hint viewed events correctly', async () => {
      const userWord1 = getUserWord(0);
      const userWord2 = getUserWord(1);

      await db.insert(Event).values([
        {
          userId,
          userWordId: userWord1.id,
          type: EventType.HintViewed,
          taskType: TaskType.WordToDefinition,
          hint: 'Test hint 1',
        },
        {
          userId,
          userWordId: userWord1.id,
          type: EventType.HintViewed,
          taskType: TaskType.DefinitionToWord,
          hint: 'Test hint 2',
        },
        {
          userId,
          userWordId: userWord2.id,
          type: EventType.HintViewed,
          taskType: TaskType.WordToTranslation,
          hint: 'Test hint 3',
        },
        {
          userId,
          userWordId: userWord2.id,
          type: EventType.HintViewed,
          taskType: TaskType.TranslationToWord,
          hint: 'Test hint 4',
        },
        {
          userId,
          userWordId: userWord2.id,
          type: EventType.HintViewed,
          taskType: TaskType.WordOrder,
          hint: 'Test hint 5',
        },
      ]);

      const result = await getStatistics({ userId });
      expect(result.general.totalHintsViewed).toBe(5);
    });

    it('counts hint viewed events only for the specified user', async () => {
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
          type: EventType.HintViewed,
          taskType: TaskType.WordToDefinition,
          hint: 'Test hint 1',
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.HintViewed,
          taskType: TaskType.DefinitionToWord,
          hint: 'Test hint 2',
        },
        {
          userId: otherUserId,
          userWordId: otherUserWord.id,
          type: EventType.HintViewed,
          taskType: TaskType.WordToTranslation,
          hint: 'Other user hint 1',
        },
        {
          userId: otherUserId,
          userWordId: otherUserWord.id,
          type: EventType.HintViewed,
          taskType: TaskType.TranslationToWord,
          hint: 'Other user hint 2',
        },
      ]);

      const result = await getStatistics({ userId });
      expect(result.general.totalHintsViewed).toBe(2);

      await db.delete(Event).where(eq(Event.userId, otherUserId));
      await db.delete(UserWord).where(eq(UserWord.userId, otherUserId));
    });

    it('returns correct hints viewed per day statistics within date range', async () => {
      const userWord1 = getUserWord(0);
      const userWord2 = getUserWord(1);
      const today = new Date();
      const yesterday = daysAgo(1);
      const weekAgo = daysAgo(6);

      await db.insert(Event).values([
        {
          userId,
          userWordId: userWord1.id,
          type: EventType.HintViewed,
          taskType: TaskType.WordToDefinition,
          hint: 'Today hint 1',
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord1.id,
          type: EventType.HintViewed,
          taskType: TaskType.DefinitionToWord,
          hint: 'Today hint 2',
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord2.id,
          type: EventType.HintViewed,
          taskType: TaskType.WordToTranslation,
          hint: 'Today hint 3',
          createdAt: today,
        },
        {
          userId,
          userWordId: userWord1.id,
          type: EventType.HintViewed,
          taskType: TaskType.TranslationToWord,
          hint: 'Yesterday hint 1',
          createdAt: yesterday,
        },
        {
          userId,
          userWordId: userWord2.id,
          type: EventType.HintViewed,
          taskType: TaskType.WordOrder,
          hint: 'Yesterday hint 2',
          createdAt: yesterday,
        },
        {
          userId,
          userWordId: userWord1.id,
          type: EventType.HintViewed,
          taskType: TaskType.FillInTheGap,
          hint: 'Week ago hint',
          createdAt: weekAgo,
        },
      ]);

      const result = await getStatistics({ userId });

      const todayStats = result.learningPerDay.find((day) => day.date === toDateOnlyString(today));
      expect(todayStats).toBeDefined();
      expect(todayStats?.hintsViewed).toBe(3);

      const yesterdayStats = result.learningPerDay.find((day) => day.date === toDateOnlyString(yesterday));
      expect(yesterdayStats).toBeDefined();
      expect(yesterdayStats?.hintsViewed).toBe(2);

      const weekAgoStats = result.learningPerDay.find((day) => day.date === toDateOnlyString(weekAgo));
      expect(weekAgoStats).toBeDefined();
      expect(weekAgoStats?.hintsViewed).toBe(1);
    });
  });
});
