import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { apiRequest, getIsomorphicAppClient } from '@/services/api';
import { LearningStatus } from '@/const/vocabulary';
import { pageHead } from '@/utils/page';
import { getVocabularyListTitle } from '@/features/user-vocabulary/utils/vocabulary';
import { VocabularyListPage } from '@/features/user-vocabulary/pages/vocabulary-list-page';

const vocabularyListSearchSchema = z.object({
  status: z.enum(LearningStatus).optional(),
  search: z.string().trim().min(1).max(255).optional(),
});

export const Route = createFileRoute('/_auth/vocabulary-lists_/$userVocabularyListId')({
  validateSearch: vocabularyListSearchSchema,
  loader: async ({ params: { userVocabularyListId } }) => {
    const app = await getIsomorphicAppClient();

    return apiRequest(
      () =>
        app.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].$get({
          param: { userVocabularyListId },
        }),
      'Failed to load vocabulary list',
    );
  },
  head: ({ loaderData }) =>
    pageHead(loaderData ? getVocabularyListTitle(loaderData.vocabularyList) : 'Vocabulary List'),
  component: VocabularyListPage,
});
