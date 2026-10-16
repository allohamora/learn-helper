import type { FC } from 'react';
import { EditVocabularyItemTranslationDialog } from '../components/edit-vocabulary-item-translation-dialog';
import { Learn } from '../components/learn';
import { EditVocabularyItemTranslationProvider } from '../components/edit-vocabulary-item-translation';

interface VocabularyListLearnPageProps {
  userVocabularyListId: string;
}

export const VocabularyListLearnPage: FC<VocabularyListLearnPageProps> = ({ userVocabularyListId }) => {
  return (
    <EditVocabularyItemTranslationProvider userVocabularyListId={userVocabularyListId}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Learn userVocabularyListId={userVocabularyListId} />
      </div>

      <EditVocabularyItemTranslationDialog />
    </EditVocabularyItemTranslationProvider>
  );
};
