import { describe, expect, it } from 'vitest';
import { user, vocabularyList } from '@/server/db/db.schema';
import { db } from '@/server/db/db.service';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';
import { addVocabularyListToUser } from '@/server/user-vocabulary/user-vocabulary-list.service';
import { getUserAvailableVocabularyLists } from '@/server/user-vocabulary/user-vocabulary-list.repository';

const createTestUser = async (id: string) => {
  const [row] = await db
    .insert(user)
    .values({ id, name: 'Test User', email: `${id}@example.com` })
    .returning();
  if (!row) throw new Error('expected user to be created');

  return row;
};

const createVocabularyList = async (title: string, createdAt: Date) => {
  const [row] = await db.insert(vocabularyList).values({ title, createdAt }).returning();
  if (!row) throw new Error('expected vocabulary list to be created');

  return row;
};

describe('userVocabularyListRepository', () => {
  describe('getUserAvailableVocabularyLists', () => {
    it('returns a list with a null addedAt when the user has not added it', async () => {
      const { id: userId } = await createTestUser('user-1');
      await findOrCreateVocabularyListByTitle('Oxford 5000 A1');

      const lists = await getUserAvailableVocabularyLists(userId);

      expect(lists).toMatchObject([{ title: 'Oxford 5000 A1', addedAt: null }]);
    });

    it('marks an enrolled list as added and sorts it first', async () => {
      const { id: userId } = await createTestUser('user-1');
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      await findOrCreateVocabularyListByTitle('Oxford 5000 A2');

      await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      const lists = await getUserAvailableVocabularyLists(userId);

      expect(lists).toMatchObject([
        { title: 'Oxford 5000 A1', addedAt: expect.any(Date) },
        { title: 'Oxford 5000 A2', addedAt: null },
      ]);
    });

    it('sorts by enrollment first and then by vocabulary list creation date', async () => {
      const { id: userId } = await createTestUser('user-1');
      const unaddedOld = await createVocabularyList('Unadded Old', new Date('2024-01-01T00:00:00Z'));
      const addedNew = await createVocabularyList('Added New', new Date('2024-01-04T00:00:00Z'));
      const addedOld = await createVocabularyList('Added Old', new Date('2024-01-02T00:00:00Z'));
      const unaddedNew = await createVocabularyList('Unadded New', new Date('2024-01-03T00:00:00Z'));

      await addVocabularyListToUser({ userId, vocabularyListId: addedNew.id });
      await addVocabularyListToUser({ userId, vocabularyListId: addedOld.id });

      const lists = await getUserAvailableVocabularyLists(userId);

      expect(lists.map((list) => list.vocabularyListId)).toEqual([
        addedOld.id,
        addedNew.id,
        unaddedOld.id,
        unaddedNew.id,
      ]);
    });
  });
});
