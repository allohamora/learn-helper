import { createFileRoute } from '@tanstack/react-router';
import { apiRequest, getIsomorphicAppClient } from '@/services/api';
import { routeHead } from '@/utils/route';
import { getVocabularyListTitle } from '@/features/user-vocabulary/utils/vocabulary';
import { VocabularyListDiscoverPage } from '@/features/user-vocabulary/pages/vocabulary-list-discover-page';

export const Route = createFileRoute('/_auth/vocabulary-lists_/$userVocabularyListId_/discover')({
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
    routeHead(loaderData ? `Discover: ${getVocabularyListTitle(loaderData.vocabularyList)}` : 'Discover'),
  component: RouteComponent,
});

function RouteComponent() {
  const { userVocabularyListId } = Route.useParams();

  return <VocabularyListDiscoverPage userVocabularyListId={userVocabularyListId} />;
}
