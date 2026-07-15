import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db/db.service';
import { user, userVocabularyItem } from '@/server/db/db.schema';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';
import { createUserVocabularyItemsFromList } from '@/server/user-vocabulary/user-vocabulary-item.repository';
import { getNewItems, getReviewItems } from '@/server/user-vocabulary/user-vocabulary-list-item.repository';
import { LearningStatus, PartOfSpeech } from '@/const/vocabulary';

const USER_ID = 'learning-items-user';
const BASE_TIME = new Date('2026-01-01T00:00:00Z').getTime();

type SeedValue = {
  value: string;
  encounterCount: number;
  offsetSeconds: number;
  status?: LearningStatus;
};

const seedLearningItems = async ({
  userId = USER_ID,
  values,
  listTitle = 'Oxford 5000 A1',
}: {
  userId?: string;
  values: SeedValue[];
  listTitle?: string;
}) => {
  await db
    .insert(user)
    .values({ id: userId, name: `Test User ${userId}`, email: `${userId}@example.com` })
    .onConflictDoNothing();

  const list = await findOrCreateVocabularyListByTitle(listTitle);
  const items = await createMissingVocabularyItems(
    values.map(({ value }) => ({
      value,
      definition: `definition of ${value}`,
      uaTranslation: value,
      partOfSpeech: PartOfSpeech.Verb,
      spelling: value,
    })),
  );
  await createVocabularyListItemsIfNotExist(
    items.map((item) => ({ vocabularyListId: list.id, vocabularyItemId: item.id })),
  );
  await createUserVocabularyItemsFromList({ userId, vocabularyListId: list.id });

  for (const { value, encounterCount, offsetSeconds, status = LearningStatus.Learning } of values) {
    const item = items.find((i) => i.value === value);
    if (!item) throw new Error(`expected item ${value} to be created`);

    await db
      .update(userVocabularyItem)
      .set({ status, encounterCount, enqueuedAt: new Date(BASE_TIME + offsetSeconds * 1000) })
      .where(and(eq(userVocabularyItem.userId, userId), eq(userVocabularyItem.vocabularyItemId, item.id)));
  }

  return { list, items };
};

describe('user-vocabulary-list-item.repository', () => {
  describe('getNewItems', () => {
    it('returns only Learning-status items with encounterCount 0, ordered by enqueuedAt ascending', async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'banana', encounterCount: 0, offsetSeconds: 1 },
          { value: 'apple', encounterCount: 0, offsetSeconds: 0 },
          { value: 'date', encounterCount: 1, offsetSeconds: 0 },
          { value: 'cherry', encounterCount: 0, offsetSeconds: 2, status: LearningStatus.Waiting },
        ],
      });

      const items = await getNewItems({ userId: USER_ID, vocabularyListId: list.id, limit: 10 });

      expect(items.map((item) => item.vocabularyItem.value)).toEqual(['apple', 'banana']);
    });

    it('respects the limit', async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'kiwi', encounterCount: 0, offsetSeconds: 0 },
          { value: 'lemon', encounterCount: 0, offsetSeconds: 1 },
          { value: 'mango', encounterCount: 0, offsetSeconds: 2 },
        ],
      });

      const items = await getNewItems({ userId: USER_ID, vocabularyListId: list.id, limit: 2 });

      expect(items.map((item) => item.vocabularyItem.value)).toEqual(['kiwi', 'lemon']);
    });

    it('scopes items to the given list and user', async () => {
      const { list: listA } = await seedLearningItems({
        values: [{ value: 'swim', encounterCount: 0, offsetSeconds: 0 }],
        listTitle: 'Oxford 5000 A1',
      });
      await seedLearningItems({
        values: [{ value: 'fly', encounterCount: 0, offsetSeconds: 0 }],
        listTitle: 'Oxford 5000 A2',
      });
      await seedLearningItems({
        userId: 'other-learning-items-user',
        values: [{ value: 'read', encounterCount: 0, offsetSeconds: 0 }],
        listTitle: 'Oxford 5000 A1',
      });

      const items = await getNewItems({ userId: USER_ID, vocabularyListId: listA.id, limit: 10 });

      expect(items.map((item) => item.vocabularyItem.value)).toEqual(['swim']);
    });

    it('returns an empty array when the user has no matching items in the list', async () => {
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');

      const items = await getNewItems({ userId: USER_ID, vocabularyListId: list.id, limit: 10 });

      expect(items).toEqual([]);
    });
  });

  describe('getReviewItems', () => {
    it('returns only Learning-status items with encounterCount >= 1, ordered by enqueuedAt ascending', async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'grape', encounterCount: 3, offsetSeconds: 1 },
          { value: 'fig', encounterCount: 1, offsetSeconds: 0 },
          { value: 'honeydew', encounterCount: 0, offsetSeconds: 0 },
          { value: 'elderberry', encounterCount: 2, offsetSeconds: 2, status: LearningStatus.Learned },
        ],
      });

      const items = await getReviewItems({ userId: USER_ID, vocabularyListId: list.id, limit: 10 });

      expect(items.map((item) => item.vocabularyItem.value)).toEqual(['fig', 'grape']);
    });

    it('respects the limit', async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'lemon', encounterCount: 1, offsetSeconds: 0 },
          { value: 'mango', encounterCount: 1, offsetSeconds: 1 },
          { value: 'nectarine', encounterCount: 1, offsetSeconds: 2 },
        ],
      });

      const items = await getReviewItems({ userId: USER_ID, vocabularyListId: list.id, limit: 2 });

      expect(items.map((item) => item.vocabularyItem.value)).toEqual(['lemon', 'mango']);
    });

    it('scopes items to the given list and user', async () => {
      const { list: listA } = await seedLearningItems({
        values: [{ value: 'swim', encounterCount: 1, offsetSeconds: 0 }],
        listTitle: 'Oxford 5000 A1',
      });
      await seedLearningItems({
        values: [{ value: 'fly', encounterCount: 1, offsetSeconds: 0 }],
        listTitle: 'Oxford 5000 A2',
      });
      await seedLearningItems({
        userId: 'other-learning-items-user',
        values: [{ value: 'read', encounterCount: 1, offsetSeconds: 0 }],
        listTitle: 'Oxford 5000 A1',
      });

      const items = await getReviewItems({ userId: USER_ID, vocabularyListId: listA.id, limit: 10 });

      expect(items.map((item) => item.vocabularyItem.value)).toEqual(['swim']);
    });

    it('returns an empty array when the user has no matching items in the list', async () => {
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');

      const items = await getReviewItems({ userId: USER_ID, vocabularyListId: list.id, limit: 10 });

      expect(items).toEqual([]);
    });
  });
});
