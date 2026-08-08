import { describe, expect, it } from 'vitest';
import { user, vocabularyList } from '@/server/db/db.schema';
import { db } from '@/server/db/db.service';
import { VocabularyListType } from '@/const/vocabulary';
import {
  createPersonalVocabularyList,
  getPersonalVocabularyListByOwnerId,
  getVocabularyListById,
  getVocabularyListByTitle,
  insertVocabularyListIgnoringConflict,
} from '@/server/vocabulary/vocabulary-list.repository';

const createTestUser = async (id: string) => {
  const [row] = await db
    .insert(user)
    .values({ id, name: 'Test User', email: `${id}@example.com` })
    .returning();
  if (!row) throw new Error('expected user to be created');

  return row;
};

describe('vocabularyListRepository', () => {
  describe('insertVocabularyListIgnoringConflict', () => {
    it('inserts a new list and returns it', async () => {
      const inserted = await insertVocabularyListIgnoringConflict('Oxford 5000 A1');

      expect(inserted).toMatchObject({ title: 'Oxford 5000 A1' });
    });

    it('returns undefined when a list with the same title already exists', async () => {
      await insertVocabularyListIgnoringConflict('Oxford 5000 A1');

      const inserted = await insertVocabularyListIgnoringConflict('Oxford 5000 A1');

      expect(inserted).toBeUndefined();
    });
  });

  describe('getVocabularyListByTitle', () => {
    it('returns the list matching the title', async () => {
      const created = await insertVocabularyListIgnoringConflict('Oxford 5000 A1');
      if (!created) throw new Error('expected list to be created');

      const found = await getVocabularyListByTitle('Oxford 5000 A1');

      expect(found?.id).toBe(created.id);
    });

    it('returns undefined when no list matches the title', async () => {
      const found = await getVocabularyListByTitle('Nonexistent List');

      expect(found).toBeUndefined();
    });
  });

  describe('getVocabularyListById', () => {
    it('returns the list matching the id', async () => {
      const created = await insertVocabularyListIgnoringConflict('Oxford 5000 A1');
      if (!created) throw new Error('expected list to be created');

      const found = await getVocabularyListById(created.id);

      expect(found?.title).toBe('Oxford 5000 A1');
    });

    it('returns undefined when no list matches the id', async () => {
      const found = await getVocabularyListById('00000000-0000-7000-8000-000000000000');

      expect(found).toBeUndefined();
    });
  });

  describe('createPersonalVocabularyList', () => {
    it('creates a list with a null title and type personal', async () => {
      const { id: userId } = await createTestUser('user-1');

      const created = await createPersonalVocabularyList(userId);

      expect(created).toMatchObject({ ownerId: userId, type: VocabularyListType.Personal, title: null });
    });

    it('creates independent rows for different users', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { id: otherUserId } = await createTestUser('user-2');

      const created = await createPersonalVocabularyList(userId);
      const otherCreated = await createPersonalVocabularyList(otherUserId);

      expect(created.id).not.toBe(otherCreated.id);
    });

    it('throws when creating a second personal list for the same user', async () => {
      const { id: userId } = await createTestUser('user-1');
      const first = await createPersonalVocabularyList(userId);

      await expect(createPersonalVocabularyList(userId)).rejects.toThrow();

      const rows = await db.query.vocabularyList.findMany({
        where: (list, { eq }) => eq(list.ownerId, userId),
      });
      expect(rows).toEqual([first]);
    });

    it('enforces at most one personal list per user at the DB level, even bypassing the repository helper', async () => {
      const { id: userId } = await createTestUser('user-1');
      const first = await createPersonalVocabularyList(userId);

      await expect(
        db.insert(vocabularyList).values({ ownerId: userId, type: VocabularyListType.Personal, title: null }),
      ).rejects.toThrow();

      const rows = await db.query.vocabularyList.findMany({
        where: (list, { eq }) => eq(list.ownerId, userId),
      });
      expect(rows).toEqual([first]);
    });

    it('does not conflict with a public list that has no owner', async () => {
      const first = await db
        .insert(vocabularyList)
        .values({ type: VocabularyListType.Public, title: 'Oxford 5000 A1' })
        .returning();
      const second = await db
        .insert(vocabularyList)
        .values({ type: VocabularyListType.Public, title: 'Oxford 5000 A2' })
        .returning();

      expect(first[0]?.ownerId).toBeNull();
      expect(second[0]?.ownerId).toBeNull();
    });

    it('rejects a personal list with no owner', async () => {
      await expect(
        db.insert(vocabularyList).values({ type: VocabularyListType.Personal, title: null }),
      ).rejects.toThrow();
    });

    it('rejects a public list with no title', async () => {
      await expect(db.insert(vocabularyList).values({ type: VocabularyListType.Public })).rejects.toThrow();
    });

    it('rejects a second public list with a duplicate title', async () => {
      await db.insert(vocabularyList).values({ type: VocabularyListType.Public, title: 'Oxford 5000 A1' });

      await expect(
        db.insert(vocabularyList).values({ type: VocabularyListType.Public, title: 'Oxford 5000 A1' }),
      ).rejects.toThrow();
    });

    it('allows several public lists and title-less personal lists to coexist', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { id: otherUserId } = await createTestUser('user-2');

      await db.insert(vocabularyList).values({ type: VocabularyListType.Public, title: 'Oxford 5000 A1' });
      await db.insert(vocabularyList).values({ type: VocabularyListType.Public, title: 'Oxford 5000 A2' });
      await createPersonalVocabularyList(userId);
      await createPersonalVocabularyList(otherUserId);

      const rows = await db.query.vocabularyList.findMany();
      expect(rows).toHaveLength(4);
    });
  });

  describe('getPersonalVocabularyListByOwnerId', () => {
    it('returns the personal list owned by the user', async () => {
      const { id: userId } = await createTestUser('user-1');
      const created = await createPersonalVocabularyList(userId);

      const found = await getPersonalVocabularyListByOwnerId(userId);

      expect(found?.id).toBe(created.id);
    });

    it('returns undefined when the user has no personal list', async () => {
      const { id: userId } = await createTestUser('user-1');

      const found = await getPersonalVocabularyListByOwnerId(userId);

      expect(found).toBeUndefined();
    });
  });
});
