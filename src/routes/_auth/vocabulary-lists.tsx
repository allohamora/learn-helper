import { createFileRoute } from '@tanstack/react-router';
import { apiRequest, getIsomorphicAppClient } from '@/services/api';
import { VocabularyListsPage } from '@/features/user-vocabulary/pages/vocabulary-lists-page';
import { routeHead } from '@/utils/route';

export const Route = createFileRoute('/_auth/vocabulary-lists')({
  head: () => routeHead('Vocabulary Lists'),
  loader: async () => {
    const app = await getIsomorphicAppClient();

    return apiRequest(
      () => app.api.v1.users.me['vocabulary-lists'].available.$get(),
      'Failed to load vocabulary lists',
    );
  },
  component: RouteComponent,
});

function RouteComponent() {
  const lists = Route.useLoaderData();

  return <VocabularyListsPage lists={lists} />;
}
