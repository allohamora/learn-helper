import { db, eq, and, Event, Word, UserWord } from 'astro:db';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { updateWord } from '@/services/word.service';
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

  describe('updateWord', () => {
    it('updates the Ukrainian translation on the Word table', async () => {
      const userWord = getUserWord();
      const newTranslation = 'тестова переклад';

      await updateWord({
        userId,
        wordId: userWord.wordId,
        uaTranslation: newTranslation,
      });

      const [updatedWord] = await db.select().from(Word).where(eq(Word.id, userWord.wordId));
      expect(updatedWord?.uaTranslation).toBe(newTranslation);
    });

    it('inserts a WordUpdated event with correct fields', async () => {
      const userWord = getUserWord();

      await updateWord({ userId, wordId: userWord.wordId, uaTranslation: 'перекладок' });

      const events = await db
        .select()
        .from(Event)
        .where(and(eq(Event.userId, userId), eq(Event.type, EventType.WordUpdated)));

      expect(events).toHaveLength(1);
      expect(events[0]?.wordId).toBe(userWord.wordId);
      expect(events[0]?.fieldName).toBe('uaTranslation');
      expect(events[0]?.type).toBe(EventType.WordUpdated);
    });

    it('does not affect translations of other words', async () => {
      const targetWord = getUserWord(0);
      const otherWord = getUserWord(1);
      const originalOtherTranslation = otherWord.word.uaTranslation;

      await updateWord({
        userId,
        wordId: targetWord.wordId,
        uaTranslation: 'новий перекладок',
      });

      const [unchangedWord] = await db.select().from(Word).where(eq(Word.id, otherWord.wordId));
      expect(unchangedWord?.uaTranslation).toBe(originalOtherTranslation);
    });

    it('records the event only for the calling user', async () => {
      const otherUserId = randomUUID();
      const userWord = getUserWord();

      await updateWord({ userId, wordId: userWord.wordId, uaTranslation: 'перекладок' });

      const otherUserEvents = await db
        .select()
        .from(Event)
        .where(and(eq(Event.userId, otherUserId), eq(Event.type, EventType.WordUpdated)));

      expect(otherUserEvents).toHaveLength(0);
    });

    it('subsequent updates overwrite the translation and record separate events', async () => {
      const userWord = getUserWord();

      await updateWord({
        userId,
        wordId: userWord.wordId,
        uaTranslation: 'перший перекладок',
      });
      await updateWord({
        userId,
        wordId: userWord.wordId,
        uaTranslation: 'другий перекладок',
      });

      const [updatedWord] = await db.select().from(Word).where(eq(Word.id, userWord.wordId));
      expect(updatedWord?.uaTranslation).toBe('другий перекладок');

      const events = await db
        .select()
        .from(Event)
        .where(and(eq(Event.userId, userId), eq(Event.type, EventType.WordUpdated)));

      expect(events).toHaveLength(2);
    });
  });
});
