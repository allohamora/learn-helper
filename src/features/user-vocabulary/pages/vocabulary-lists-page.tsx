import type { ComponentProps, FC } from 'react';
import { VocabularyListRow } from '../components/vocabulary-list-row';

type VocabularyListsPageProps = {
  lists: ComponentProps<typeof VocabularyListRow>[];
};

export const VocabularyListsPage: FC<VocabularyListsPageProps> = ({ lists }) => {
  return (
    <>
      <div className="flex flex-col items-center px-4 pt-4 text-center md:pt-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-4xl">Vocabulary Lists</h1>
      </div>

      <div className="px-4 pt-6">
        {lists.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No vocabulary lists available.</p>
        ) : (
          <div className="mx-auto max-w-2xl divide-y overflow-hidden rounded-lg border text-left">
            {lists.map((list) => (
              <VocabularyListRow key={list.id} {...list} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};
