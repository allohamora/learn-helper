import '@tanstack/react-start/server-only';
import { EventType } from '@/const/event';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { Exception } from '../utils/exception.utils';
import { insertEvent } from '../event/event.repository';
import { getVocabularyItemById } from './vocabulary-item.repository';
import { generateVocabularyItemData } from './vocabulary-item-generation.service';
import type { GenerateVocabularyItemDto } from './dtos/generate-vocabulary-item.dto';

export const getVocabularyItemByIdOrThrow = async (vocabularyItemId: string, tx: Transaction = db) => {
  const item = await getVocabularyItemById(vocabularyItemId, tx);
  if (!item) throw Exception.notFound(`vocabulary item "${vocabularyItemId}" not found`);

  return item;
};

export const generateVocabularyItemContent = async ({
  userId,
  ...data
}: GenerateVocabularyItemDto & { userId: string }) => {
  const { output, cost } = await generateVocabularyItemData(data);

  await insertEvent({
    type: EventType.VocabularyItemGenerated,
    userId,
    costInNanoDollars: cost.costInNanoDollars,
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
    metadata: { input: data, output },
  });

  const { isLearnable, ...vocabularyItemData } = output;
  if (!isLearnable) {
    throw Exception.badRequest(`value "${output.value}" is not a learnable word or fixed phrase`);
  }

  return vocabularyItemData;
};
