import { createFileRoute } from '@tanstack/react-router';
import { EditVocabularyItemTranslationDialog } from '@/components/edit-vocabulary-item-translation-dialog';
import { Learn } from '@/components/learn';
import { EditVocabularyItemTranslationProvider } from '@/components/providers/edit-vocabulary-item-translation';
import { getIsomorphicAppClient } from '@/services/api';
import { pageHead } from '@/utils/page';

export const Route = createFileRoute('/_auth/vocabulary-lists_/$userVocabularyListId_/learn')({
  loader: async ({ params: { userVocabularyListId } }) => {
    const app = await getIsomorphicAppClient();
    const response = await app.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].$get({
      param: { userVocabularyListId },
    });
    if (!response.ok) throw new Error('Failed to load vocabulary list');
    return (await response.json()).data;
  },
  head: ({ loaderData }) => pageHead(loaderData ? `Learn: ${loaderData.vocabularyList.title}` : 'Learn'),
  component: VocabularyListLearnPage,
});

function VocabularyListLearnPage() {
  const { userVocabularyListId } = Route.useParams();
  const userVocabularyList = Route.useLoaderData();

  return (
    <EditVocabularyItemTranslationProvider userVocabularyListId={userVocabularyListId}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">
          {userVocabularyList.vocabularyList.title}
        </h1>

        <Learn userVocabularyListId={userVocabularyListId} />
      </div>

      <EditVocabularyItemTranslationDialog />
    </EditVocabularyItemTranslationProvider>
  );
}
