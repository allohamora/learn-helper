import { db, eq, Event, UserWord } from 'astro:db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getStatistics } from '@/services/statistics.service';
import { Status, type UserWord as UserWordMapped } from '@/types/user-words.types';
import { ensureUserWordsExists, getUserWords } from '@/repositories/user-word.repository';
import { EventType } from '@/types/event.types';
import { daysAgo, toDateOnlyString } from '@/utils/date.utils';

describe('statistics.service', () => {
  const userId = randomUUID();

  let userWords: UserWordMapped[];

  const getUserWord = (idx = 0) => {
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
        totalWordsMovedToNextStep: 0,
        totalDiscoveringDurationMs: 0,
        averageTimePerDiscoveryMs: 0,
      });
      expect(result.discoveringPerDay).toHaveLength(7);

      for (const day of result.discoveringPerDay) {
        expect(day.learningCount).toBe(0);
        expect(day.knownCount).toBe(0);
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
          type: EventType.WordMovedToNextStep,
        },
        {
          userId: otherUserId,
          userWordId: otherUserWord.id,
          type: EventType.WordDiscovered,
          status: Status.Known,
          durationMs: 2000,
        },
      ]);

      const result = await getStatistics({ userId });

      expect(result.general).toEqual({
        totalDiscoveredWords: 1,
        totalWordsMovedToNextStep: 1,
        totalDiscoveringDurationMs: 3000,
        averageTimePerDiscoveryMs: 3000,
      });

      const totalDiscoveringEvents = result.discoveringPerDay.reduce(
        (sum, day) => sum + day.learningCount + day.knownCount,
        0,
      );
      expect(totalDiscoveringEvents).toBe(1);

      await db.delete(Event).where(eq(Event.userId, otherUserId));
      await db.delete(UserWord).where(eq(UserWord.userId, otherUserId));
    });

    it('handles discovery events across the 7-day range', async () => {
      const userWord = getUserWord();
      const inRangeDate = daysAgo(2);
      const outOfRangeDate = daysAgo(30);

      await db.insert(Event).values([
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordDiscovered,
          status: Status.Learning,
          durationMs: 2000,
          createdAt: inRangeDate,
        },
        {
          userId,
          userWordId: userWord.id,
          type: EventType.WordDiscovered,
          status: Status.Known,
          durationMs: 1000,
          createdAt: outOfRangeDate,
        },
      ]);

      const result = await getStatistics({ userId });

      expect(result.general).toEqual({
        totalDiscoveredWords: 2,
        totalWordsMovedToNextStep: 0,
        totalDiscoveringDurationMs: 3000,
        averageTimePerDiscoveryMs: 1500,
      });

      const targetDate = toDateOnlyString(inRangeDate);
      const targetDay = result.discoveringPerDay.find((day) => day.date === targetDate);
      expect(targetDay?.learningCount).toBe(1);
      expect(targetDay?.knownCount).toBe(0);
      expect(targetDay?.durationMs).toBe(2000);

      const totalDiscoveringEvents = result.discoveringPerDay.reduce(
        (sum, day) => sum + day.learningCount + day.knownCount,
        0,
      );
      expect(totalDiscoveringEvents).toBe(1);
    });
  });
});
