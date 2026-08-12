import { describe, expect, it } from 'vitest';
import { Exception } from '@/server/utils/exception.utils';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { getVocabularyItemByIdOrThrow } from '@/server/vocabulary/vocabulary-item.service';
import { PartOfSpeech } from '@/const/vocabulary';

describe('vocabularyItemService', () => {
  describe('getVocabularyItemByIdOrThrow', () => {
    it('resolves with the item when it exists', async () => {
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

      await expect(getVocabularyItemByIdOrThrow(item.id)).resolves.toMatchObject({ id: item.id });
    });

    it('throws not found for a non-existent item', async () => {
      await expect(getVocabularyItemByIdOrThrow('00000000-0000-7000-8000-000000000000')).rejects.toThrow(Exception);
    });
  });
});
