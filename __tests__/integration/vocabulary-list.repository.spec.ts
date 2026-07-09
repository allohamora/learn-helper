import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { user, vocabularyList } from '@/server/db/db.schema';
import { db } from '@/server/db/db.service';
import {
  findOrCreateVocabularyListByTitle,
  getVocabularyListsForUser,
} from '@/server/vocabulary/vocabulary-list.repository';
import { addVocabularyListToUser } from '@/server/vocabulary/vocabulary.service';

const createTestUser = async (id: string) => {
  const [row] = await db
    .insert(user)
    .values({ id, name: 'Test User', email: `${id}@example.com` })
    .returning();
  if (!row) throw new Error('expected user to be created');

  return row;
};

describe('vocabularyListRepository', () => {
  describe('findOrCreateVocabularyListByTitle', () => {
    it('creates a new list on first call', async () => {
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      expect(list.title).toBe('Oxford 5000 A1');

      const found = await db.query.vocabularyList.findFirst({ where: eq(vocabularyList.title, 'Oxford 5000 A1') });
      expect(found?.id).toBe(list.id);
    });

    it('returns the existing list on repeated calls without creating a duplicate', async () => {
      const first = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const second = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');

      expect(second.id).toBe(first.id);
      expect(await countItems(vocabularyList)).toBe(1);
    });
  });

  describe('getVocabularyListsForUser', () => {
    it('returns a list with a null addedAt when the user has not added it', async () => {
      const { id: userId } = await createTestUser('user-1');
      await findOrCreateVocabularyListByTitle('Oxford 5000 A1');

      const lists = await getVocabularyListsForUser(userId);

      expect(lists).toMatchObject([{ title: 'Oxford 5000 A1', addedAt: null }]);
    });

    it('marks an enrolled list as added and sorts it first', async () => {
      const { id: userId } = await createTestUser('user-1');
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      await findOrCreateVocabularyListByTitle('Oxford 5000 A2');

      await addVocabularyListToUser(userId, list.id);

      const lists = await getVocabularyListsForUser(userId);

      expect(lists).toMatchObject([
        { title: 'Oxford 5000 A1', addedAt: expect.any(Date) },
        { title: 'Oxford 5000 A2', addedAt: null },
      ]);
    });
  });
});
