import { db, eq, UserWord } from 'astro:db';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ensureUserWordsExists, getLearningWords, getUserWordById } from '@/repositories/user-word.repository';
import { moveUserWordToNextStep } from '@/services/user-word.service';
import { Status } from '@/types/user-words.types';

describe('user-word.service', () => {
  const userId = randomUUID();

  const getLearningWord = async () => {
    const [word] = await getLearningWords({ userId, limit: 1 });
    if (!word) {
      throw new Error('No learning word found');
    }

    return word;
  };

  beforeEach(async () => {
    await ensureUserWordsExists(userId);
    await db.update(UserWord).set({ status: Status.Learning });
  });

  afterEach(async () => {
    await db.delete(UserWord).where(eq(UserWord.userId, userId));
  });

  describe('integration', () => {
    it('cycles learning words correctly through multiple steps', async () => {
      const handled = new Set<number>();

      const expectUpdate = async ({
        userWordId,
        encounterCount,
        wordsToUnlock,
        status,
      }: {
        userWordId: number;
        encounterCount: number;
        wordsToUnlock: number;
        status: Status;
      }) => {
        const updated = await getUserWordById({ userId, userWordId });

        expect(updated.encounterCount).toBe(encounterCount);
        expect(updated.wordsToUnlock).toEqual(wordsToUnlock);
        expect(updated.status).toBe(status);

        handled.add(userWordId);
      };

      const expectNewWord = (userWord: typeof UserWord.$inferSelect) => {
        expect(handled.has(userWord.id)).toBe(false);
        expect(userWord.encounterCount).toBe(0);
      };

      const firstWord = await getLearningWord();
      expectNewWord(firstWord);

      await moveUserWordToNextStep({ userId, userWordId: firstWord.id });

      await expectUpdate({ userWordId: firstWord.id, encounterCount: 1, wordsToUnlock: 3, status: Status.Learning });

      const secondWord = await getLearningWord();
      expectNewWord(secondWord);

      await moveUserWordToNextStep({ userId, userWordId: secondWord.id });

      await expectUpdate({ userWordId: firstWord.id, encounterCount: 1, wordsToUnlock: 2, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, encounterCount: 1, wordsToUnlock: 5, status: Status.Learning });

      const thirdWord = await getLearningWord();
      expectNewWord(thirdWord);

      await moveUserWordToNextStep({ userId, userWordId: thirdWord.id });

      await expectUpdate({ userWordId: firstWord.id, encounterCount: 1, wordsToUnlock: 1, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, encounterCount: 1, wordsToUnlock: 4, status: Status.Learning });
      await expectUpdate({ userWordId: thirdWord.id, encounterCount: 1, wordsToUnlock: 7, status: Status.Learning });

      const fourthWord = await getLearningWord();
      expectNewWord(fourthWord);

      await moveUserWordToNextStep({ userId, userWordId: fourthWord.id });

      await expectUpdate({ userWordId: firstWord.id, encounterCount: 1, wordsToUnlock: 0, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, encounterCount: 1, wordsToUnlock: 3, status: Status.Learning });
      await expectUpdate({ userWordId: thirdWord.id, encounterCount: 1, wordsToUnlock: 6, status: Status.Learning });
      await expectUpdate({ userWordId: fourthWord.id, encounterCount: 1, wordsToUnlock: 9, status: Status.Learning });

      const fifthWord = await getLearningWord();
      expect(fifthWord.id).toBe(firstWord.id);

      await moveUserWordToNextStep({ userId, userWordId: firstWord.id });

      await expectUpdate({ userWordId: firstWord.id, encounterCount: 2, wordsToUnlock: 11, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, encounterCount: 1, wordsToUnlock: 2, status: Status.Learning });
      await expectUpdate({ userWordId: thirdWord.id, encounterCount: 1, wordsToUnlock: 5, status: Status.Learning });
      await expectUpdate({ userWordId: fourthWord.id, encounterCount: 1, wordsToUnlock: 8, status: Status.Learning });

      const sixthWord = await getLearningWord();
      expectNewWord(sixthWord);

      await moveUserWordToNextStep({ userId, userWordId: sixthWord.id });

      await expectUpdate({ userWordId: firstWord.id, encounterCount: 2, wordsToUnlock: 10, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, encounterCount: 1, wordsToUnlock: 1, status: Status.Learning });
      await expectUpdate({ userWordId: thirdWord.id, encounterCount: 1, wordsToUnlock: 4, status: Status.Learning });
      await expectUpdate({ userWordId: fourthWord.id, encounterCount: 1, wordsToUnlock: 7, status: Status.Learning });
      await expectUpdate({ userWordId: sixthWord.id, encounterCount: 1, wordsToUnlock: 13, status: Status.Learning });

      const seventhWord = await getLearningWord();
      expectNewWord(seventhWord);

      await moveUserWordToNextStep({ userId, userWordId: seventhWord.id });

      await expectUpdate({ userWordId: firstWord.id, encounterCount: 2, wordsToUnlock: 9, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, encounterCount: 1, wordsToUnlock: 0, status: Status.Learning });
      await expectUpdate({ userWordId: thirdWord.id, encounterCount: 1, wordsToUnlock: 3, status: Status.Learning });
      await expectUpdate({ userWordId: fourthWord.id, encounterCount: 1, wordsToUnlock: 6, status: Status.Learning });
      await expectUpdate({ userWordId: sixthWord.id, encounterCount: 1, wordsToUnlock: 12, status: Status.Learning });
      await expectUpdate({ userWordId: seventhWord.id, encounterCount: 1, wordsToUnlock: 15, status: Status.Learning });

      const eighthWord = await getLearningWord();
      expect(eighthWord.id).toBe(secondWord.id);

      await moveUserWordToNextStep({ userId, userWordId: eighthWord.id });

      await expectUpdate({ userWordId: firstWord.id, encounterCount: 2, wordsToUnlock: 8, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, encounterCount: 2, wordsToUnlock: 17, status: Status.Learning });
      await expectUpdate({ userWordId: thirdWord.id, encounterCount: 1, wordsToUnlock: 2, status: Status.Learning });
      await expectUpdate({ userWordId: fourthWord.id, encounterCount: 1, wordsToUnlock: 5, status: Status.Learning });
      await expectUpdate({ userWordId: sixthWord.id, encounterCount: 1, wordsToUnlock: 11, status: Status.Learning });
      await expectUpdate({ userWordId: seventhWord.id, encounterCount: 1, wordsToUnlock: 14, status: Status.Learning });

      for (let i = 0; i < 8; i++) {
        const word = await getLearningWord();

        await moveUserWordToNextStep({ userId, userWordId: word.id });
      }

      const seventeenWord = await getLearningWord();
      expect(seventeenWord.id).toBe(firstWord.id);

      await moveUserWordToNextStep({ userId, userWordId: seventeenWord.id });

      await expectUpdate({ userWordId: seventeenWord.id, encounterCount: 3, wordsToUnlock: 0, status: Status.Learned });

      const eighteenWord = await getLearningWord();
      expectNewWord(eighteenWord);
    });
  });
});
