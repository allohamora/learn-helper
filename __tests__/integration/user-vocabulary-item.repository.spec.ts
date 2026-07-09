import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { db } from '@/server/db/db.service';
import { PartOfSpeech, user, userVocabularyItem } from '@/server/db/db.schema';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';
import { createUserVocabularyItemsFromList } from '@/server/vocabulary/user-vocabulary-item.repository';

describe('userVocabularyItemRepository', () => {
  describe('createUserVocabularyItemsFromList', () => {
    it('creates progress rows for every item in the list without creating duplicates on re-run', async () => {
      const [{ id: userId }] = await db
        .insert(user)
        .values({ id: 'user-1', name: 'Test User', email: 'test-user-1@example.com' })
        .returning();
      if (!userId) throw new Error('expected user to be created');

      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const items = await createMissingVocabularyItems([
        {
          value: 'run',
          definition: 'to move fast on foot',
          uaTranslation: 'бігти',
          partOfSpeech: PartOfSpeech.Verb,
          spelling: '/rʌn/',
        },
      ]);
      await createVocabularyListItemsIfNotExist(
        items.map((item) => ({ vocabularyListId: list.id, vocabularyItemId: item.id })),
      );

      await createUserVocabularyItemsFromList(userId, list.id);
      await createUserVocabularyItemsFromList(userId, list.id);

      expect(await countItems(userVocabularyItem)).toBe(items.length);
    });
  });
});
