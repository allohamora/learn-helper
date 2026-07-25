import '@tanstack/react-start/server-only';
import { vocabularyListDto } from '../../vocabulary/dtos/vocabulary-list.dto';
import { userVocabularyListDto } from './user-vocabulary-list.dto';

export const userVocabularyListWithRelationsDto = userVocabularyListDto.extend({
  vocabularyList: vocabularyListDto,
});
