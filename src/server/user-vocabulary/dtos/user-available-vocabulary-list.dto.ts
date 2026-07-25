import '@tanstack/react-start/server-only';
import { vocabularyListDto } from '../../vocabulary/dtos/vocabulary-list.dto';
import { userVocabularyListDto } from './user-vocabulary-list.dto';

export const userAvailableVocabularyListDto = vocabularyListDto.extend({
  userVocabularyList: userVocabularyListDto
    .nullable()
    .openapi({ description: "The user's enrollment for this list, null if the user has not added it" }),
});
