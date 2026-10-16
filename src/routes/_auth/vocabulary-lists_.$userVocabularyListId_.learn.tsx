import { createFileRoute } from '@tanstack/react-router';
import { apiRequest, getIsomorphicAppClient } from '@/services/api';
import { pageHead } from '@/utils/page';
import { getVocabularyListTitle } from '@/features/user-vocabulary/utils/vocabulary';
import { VocabularyListLearnPage } from '@/features/user-vocabulary/pages/vocabulary-list-learn-page';

export const Route = createFileRoute('/_auth/vocabulary-lists_/$userVocabularyListId_/learn')({
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
    pageHead(loaderData ? `Learn: ${getVocabularyListTitle(loaderData.vocabularyList)}` : 'Learn'),
  component: RouteComponent,
});

function RouteComponent() {
  const { userVocabularyListId } = Route.useParams();

  return <VocabularyListLearnPage userVocabularyListId={userVocabularyListId} />;
}
