import { db, eq, and, Event, Word, UserWord } from 'astro:db';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { updateUaTranslationWord } from '@/services/word.service';
import { ensureUserWordsExists, getUserWords } from '@/repositories/user-word.repository';
import { EventType } from '@/types/event.types';
import type { UserWord as UserWordMapped } from '@/types/user-words.types';

describe('word.service', () => {
  const userId = randomUUID();

  let userWords: UserWordMapped[];
  let originalTranslations: { id: number; uaTranslation: string }[];

  const getUserWord = (idx: number = 0) => {
    const userWord = userWords[idx];
    if (!userWord) {
      throw new Error('Failed to get test userWord');
    }

    return userWord;
  };

  beforeEach(async () => {
    await ensureUserWordsExists(userId);
    userWords = await getUserWords({ userId, limit: 5 }).then(({ data }) => data);
    originalTranslations = userWords.map((userWord) => ({
      id: userWord.wordId,
      uaTranslation: userWord.word.uaTranslation,
    }));
  });

  afterEach(async () => {
    await db.delete(Event).where(eq(Event.userId, userId));
    await db.delete(UserWord).where(eq(UserWord.userId, userId));

    for (const original of originalTranslations) {
      await db.update(Word).set({ uaTranslation: original.uaTranslation }).where(eq(Word.id, original.id));
    }
  });

  describe('updateUaTranslationWord', () => {
    it('updates the Ukrainian translation on the Word table', async () => {
      const userWord = getUserWord();
      const newTranslation = 'тестова переклад';

      await updateUaTranslationWord({
        userId,
        wordId: userWord.wordId,
        userWordId: userWord.id,
        value: newTranslation,
      });

      const [updatedWord] = await db.select().from(Word).where(eq(Word.id, userWord.wordId));
      expect(updatedWord?.uaTranslation).toBe(newTranslation);
    });

    it('inserts a UaTranslationUpdated event with correct fields', async () => {
      const userWord = getUserWord();

      await updateUaTranslationWord({ userId, wordId: userWord.wordId, userWordId: userWord.id, value: 'перекладок' });

      const events = await db
        .select()
        .from(Event)
        .where(and(eq(Event.userId, userId), eq(Event.type, EventType.UaTranslationUpdated)));

      expect(events).toHaveLength(1);
      expect(events[0]?.userWordId).toBe(userWord.id);
      expect(events[0]?.type).toBe(EventType.UaTranslationUpdated);
    });

    it('does not affect translations of other words', async () => {
      const targetWord = getUserWord(0);
      const otherWord = getUserWord(1);
      const originalOtherTranslation = otherWord.word.uaTranslation;

      await updateUaTranslationWord({
        userId,
        wordId: targetWord.wordId,
        userWordId: targetWord.id,
        value: 'новий перекладок',
      });

      const [unchangedWord] = await db.select().from(Word).where(eq(Word.id, otherWord.wordId));
      expect(unchangedWord?.uaTranslation).toBe(originalOtherTranslation);
    });

    it('records the event only for the calling user', async () => {
      const otherUserId = randomUUID();
      const userWord = getUserWord();

      await updateUaTranslationWord({ userId, wordId: userWord.wordId, userWordId: userWord.id, value: 'перекладок' });

      const otherUserEvents = await db
        .select()
        .from(Event)
        .where(and(eq(Event.userId, otherUserId), eq(Event.type, EventType.UaTranslationUpdated)));

      expect(otherUserEvents).toHaveLength(0);
    });

    it('subsequent updates overwrite the translation and record separate events', async () => {
      const userWord = getUserWord();

      await updateUaTranslationWord({
        userId,
        wordId: userWord.wordId,
        userWordId: userWord.id,
        value: 'перший перекладок',
      });
      await updateUaTranslationWord({
        userId,
        wordId: userWord.wordId,
        userWordId: userWord.id,
        value: 'другий перекладок',
      });

      const [updatedWord] = await db.select().from(Word).where(eq(Word.id, userWord.wordId));
      expect(updatedWord?.uaTranslation).toBe('другий перекладок');

      const events = await db
        .select()
        .from(Event)
        .where(and(eq(Event.userId, userId), eq(Event.type, EventType.UaTranslationUpdated)));

      expect(events).toHaveLength(2);
    });
  });
});
