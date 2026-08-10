import '@tanstack/react-start/server-only';
import { EventType } from '@/const/event';
import { insertEvent } from '../event/event.repository';
import { generateVocabularyItemData } from './vocabulary-item-generation.service';
import type { GenerateVocabularyItemDto } from './dtos/generate-vocabulary-item.dto';

export const generateVocabularyItem = async ({ userId, ...data }: GenerateVocabularyItemDto & { userId: string }) => {
  const { output, cost } = await generateVocabularyItemData(data);

  await insertEvent({
    type: EventType.VocabularyItemGenerated,
    userId,
    costInNanoDollars: cost.costInNanoDollars,
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
  });

  return output;
};
