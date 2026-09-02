import * as vocabularyItemGenerationService from '@/server/vocabulary/vocabulary-item-generation.service';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { eq } from 'drizzle-orm';
import { Exception } from '@/server/utils/exception.utils';
import { db } from '@/server/db/db.service';
import { event, user } from '@/server/db/db.schema';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import {
  generateVocabularyItemContent,
  getVocabularyItemByIdOrThrow,
} from '@/server/vocabulary/vocabulary-item.service';
import { EventType } from '@/const/event';
import { PartOfSpeech } from '@/const/vocabulary';

const createTestUser = async (id: string) => {
  const [row] = await db
    .insert(user)
    .values({ id, name: 'Test User', email: `${id}@example.com` })
    .returning();
  if (!row) throw new Error('expected user to be created');

  return row;
};

describe('vocabularyItemService', () => {
  describe('generateVocabularyItemContent', () => {
    let generateSpy: MockInstance<typeof vocabularyItemGenerationService.generateVocabularyItemData>;

    beforeEach(() => {
      generateSpy = vi
        .spyOn(vocabularyItemGenerationService, 'generateVocabularyItemData')
        .mockImplementation(async ({ value }) => ({
          output: {
            value,
            definition: `definition of ${value}`,
            uaTranslation: `переклад ${value}`,
            partOfSpeech: PartOfSpeech.Noun,
            spelling: `/${value}/`,
          },
          cost: { costInNanoDollars: 1_000_000, inputTokens: 100, outputTokens: 200 },
        }));
    });

    afterEach(() => {
      generateSpy.mockRestore();
    });

    it('returns the generated content and logs a cost event, without persisting a vocabulary item', async () => {
      const { id: userId } = await createTestUser('user-1');

      const output = await generateVocabularyItemContent({ userId, value: 'run' });

      expect(output.value).toBe('run');

      const events = await db.query.event.findMany({ where: eq(event.userId, userId) });
      expect(events).toEqual([
        expect.objectContaining({
          type: EventType.VocabularyItemGenerated,
          costInNanoDollars: 1_000_000,
          inputTokens: 100,
          outputTokens: 200,
          metadata: {
            input: { value: 'run' },
            output: {
              value: 'run',
              definition: 'definition of run',
              uaTranslation: 'переклад run',
              partOfSpeech: PartOfSpeech.Noun,
              spelling: '/run/',
            },
          },
        }),
      ]);
    });
  });

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
