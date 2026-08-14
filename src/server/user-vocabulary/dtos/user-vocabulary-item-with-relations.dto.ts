import '@tanstack/react-start/server-only';
import { vocabularyItemDto } from '../../vocabulary/dtos/vocabulary-item.dto';
import { userVocabularyItemDto } from './user-vocabulary-item.dto';

export const userVocabularyItemWithRelationsDto = userVocabularyItemDto.extend({
  vocabularyItem: vocabularyItemDto,
});
