import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { vocabularyListItem } from '@/server/db/db.schema';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import {
  createVocabularyListItemsIfNotExist,
  getVocabularyListItem,
} from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.service';
import { PartOfSpeech } from '@/const/vocabulary';

describe('vocabularyListItemRepository', () => {
  describe('createVocabularyListItemsIfNotExist', () => {
    it('links an item to a list without creating duplicates on re-run', async () => {
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const [item] = await createMissingVocabularyItems([
        {
          value: 'run',
          definition: 'to move fast on foot',
          uaTranslation: 'бігти',
          partOfSpeech: PartOfSpeech.Verb,
          spelling: '/rʌn/',
        },
      ]);
      if (!item) throw new Error('expected item to be created');

      const link = { vocabularyListId: list.id, vocabularyItemId: item.id };

      await createVocabularyListItemsIfNotExist([link]);
      await createVocabularyListItemsIfNotExist([link]);

      expect(await countItems(vocabularyListItem)).toBe(1);
    });
  });

  describe('getVocabularyListItem', () => {
    it('resolves when the item is linked to the list', async () => {
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const [item] = await createMissingVocabularyItems([
        {
          value: 'run',
          definition: 'to move fast on foot',
          uaTranslation: 'бігти',
          partOfSpeech: PartOfSpeech.Verb,
          spelling: '/rʌn/',
        },
      ]);
      if (!item) throw new Error('expected item to be created');
      await createVocabularyListItemsIfNotExist([{ vocabularyListId: list.id, vocabularyItemId: item.id }]);

      await expect(
        getVocabularyListItem({ vocabularyListId: list.id, vocabularyItemId: item.id }),
      ).resolves.toMatchObject({ vocabularyListId: list.id, vocabularyItemId: item.id });
    });

    it('resolves with undefined when the item is not linked to the list', async () => {
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A2');
      const [item] = await createMissingVocabularyItems([
        {
          value: 'walk',
          definition: 'to move on foot',
          uaTranslation: 'ходити',
          partOfSpeech: PartOfSpeech.Verb,
          spelling: '/wɔːk/',
        },
      ]);
      if (!item) throw new Error('expected item to be created');

      await expect(
        getVocabularyListItem({ vocabularyListId: list.id, vocabularyItemId: item.id }),
      ).resolves.toBeUndefined();
    });
  });
});
