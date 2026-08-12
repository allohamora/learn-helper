import '@tanstack/react-start/server-only';
import { vocabularyItemDto } from '../../vocabulary/dtos/vocabulary-item.dto';
import { vocabularyListItemDto } from '../../vocabulary/dtos/vocabulary-list-item.dto';

export const personalVocabularyItemSearchResultDto = vocabularyItemDto.extend({
  vocabularyListItem: vocabularyListItemDto
    .nullable()
    .openapi({ description: "Present if the word is already in the user's personal list" }),
});
