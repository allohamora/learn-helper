import { db, UserWord } from 'astro:db';
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
    await db.delete(UserWord);
  });

  describe('integration', () => {
    it('cycles learning words correctly through multiple steps', async () => {
      const handled = new Set<number>();

      const expectUpdate = async ({
        userWordId,
        appearsLeft,
        wordsToUnlock,
        status,
      }: {
        userWordId: number;
        appearsLeft: number;
        wordsToUnlock: number;
        status: Status;
      }) => {
        const updated = await getUserWordById({ userId, userWordId });

        expect(updated.appearsLeft).toBe(appearsLeft);
        expect(updated.wordsToUnlock).toEqual(wordsToUnlock);
        expect(updated.status).toBe(status);

        handled.add(userWordId);
      };

      const expectNewWord = (userWordId: number) => {
        expect(handled.has(userWordId)).toBe(false);
      };

      const firstWord = await getLearningWord();
      expectNewWord(firstWord.id);

      await moveUserWordToNextStep({ userId, userWordId: firstWord.id });

      await expectUpdate({ userWordId: firstWord.id, appearsLeft: 2, wordsToUnlock: 3, status: Status.Learning });

      const secondWord = await getLearningWord();
      expectNewWord(secondWord.id);

      await moveUserWordToNextStep({ userId, userWordId: secondWord.id });

      await expectUpdate({ userWordId: firstWord.id, appearsLeft: 2, wordsToUnlock: 2, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, appearsLeft: 2, wordsToUnlock: 5, status: Status.Learning });

      const thirdWord = await getLearningWord();
      expectNewWord(thirdWord.id);

      await moveUserWordToNextStep({ userId, userWordId: thirdWord.id });

      await expectUpdate({ userWordId: firstWord.id, appearsLeft: 2, wordsToUnlock: 1, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, appearsLeft: 2, wordsToUnlock: 4, status: Status.Learning });
      await expectUpdate({ userWordId: thirdWord.id, appearsLeft: 2, wordsToUnlock: 7, status: Status.Learning });

      const fourthWord = await getLearningWord();
      expectNewWord(fourthWord.id);

      await moveUserWordToNextStep({ userId, userWordId: fourthWord.id });

      await expectUpdate({ userWordId: firstWord.id, appearsLeft: 2, wordsToUnlock: 0, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, appearsLeft: 2, wordsToUnlock: 3, status: Status.Learning });
      await expectUpdate({ userWordId: thirdWord.id, appearsLeft: 2, wordsToUnlock: 6, status: Status.Learning });
      await expectUpdate({ userWordId: fourthWord.id, appearsLeft: 2, wordsToUnlock: 9, status: Status.Learning });

      const fifthWord = await getLearningWord();
      expect(fifthWord.id).toBe(firstWord.id);

      await moveUserWordToNextStep({ userId, userWordId: firstWord.id });

      await expectUpdate({ userWordId: firstWord.id, appearsLeft: 1, wordsToUnlock: 11, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, appearsLeft: 2, wordsToUnlock: 2, status: Status.Learning });
      await expectUpdate({ userWordId: thirdWord.id, appearsLeft: 2, wordsToUnlock: 5, status: Status.Learning });
      await expectUpdate({ userWordId: fourthWord.id, appearsLeft: 2, wordsToUnlock: 8, status: Status.Learning });

      const sixthWord = await getLearningWord();
      expectNewWord(sixthWord.id);

      await moveUserWordToNextStep({ userId, userWordId: sixthWord.id });

      await expectUpdate({ userWordId: firstWord.id, appearsLeft: 1, wordsToUnlock: 10, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, appearsLeft: 2, wordsToUnlock: 1, status: Status.Learning });
      await expectUpdate({ userWordId: thirdWord.id, appearsLeft: 2, wordsToUnlock: 4, status: Status.Learning });
      await expectUpdate({ userWordId: fourthWord.id, appearsLeft: 2, wordsToUnlock: 7, status: Status.Learning });
      await expectUpdate({ userWordId: sixthWord.id, appearsLeft: 2, wordsToUnlock: 13, status: Status.Learning });

      const seventhWord = await getLearningWord();
      expectNewWord(seventhWord.id);

      await moveUserWordToNextStep({ userId, userWordId: seventhWord.id });

      await expectUpdate({ userWordId: firstWord.id, appearsLeft: 1, wordsToUnlock: 9, status: Status.Learning });
      await expectUpdate({ userWordId: secondWord.id, appearsLeft: 2, wordsToUnlock: 0, status: Status.Learning });
      await expectUpdate({ userWordId: thirdWord.id, appearsLeft: 2, wordsToUnlock: 3, status: Status.Learning });
      await expectUpdate({ userWordId: fourthWord.id, appearsLeft: 2, wordsToUnlock: 6, status: Status.Learning });
      await expectUpdate({ userWordId: sixthWord.id, appearsLeft: 2, wordsToUnlock: 12, status: Status.Learning });
      await expectUpdate({ userWordId: seventhWord.id, appearsLeft: 2, wordsToUnlock: 15, status: Status.Learning });

      const eighthWord = await getLearningWord();
      expect(eighthWord.id).toBe(secondWord.id);

      await moveUserWordToNextStep({ userId, userWordId: eighthWord.id });

      await expectUpdate({ userWordId: eighthWord.id, appearsLeft: 1, wordsToUnlock: 17, status: Status.Learning });
      await expectUpdate({ userWordId: firstWord.id, appearsLeft: 1, wordsToUnlock: 8, status: Status.Learning });
      await expectUpdate({ userWordId: thirdWord.id, appearsLeft: 2, wordsToUnlock: 2, status: Status.Learning });
      await expectUpdate({ userWordId: fourthWord.id, appearsLeft: 2, wordsToUnlock: 5, status: Status.Learning });
      await expectUpdate({ userWordId: sixthWord.id, appearsLeft: 2, wordsToUnlock: 11, status: Status.Learning });
      await expectUpdate({ userWordId: seventhWord.id, appearsLeft: 2, wordsToUnlock: 14, status: Status.Learning });

      for (let i = 0; i < 8; i++) {
        const word = await getLearningWord();

        await moveUserWordToNextStep({ userId, userWordId: word.id });
      }

      const seventeenWord = await getLearningWord();
      expect(seventeenWord.id).toBe(firstWord.id);

      await moveUserWordToNextStep({ userId, userWordId: seventeenWord.id });

      await expectUpdate({ userWordId: seventeenWord.id, appearsLeft: 0, wordsToUnlock: 0, status: Status.Learned });

      const eighteenWord = await getLearningWord();
      expectNewWord(eighteenWord.id);
    });
  });
});
