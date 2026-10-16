import type { FC } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { VocabularyListRow } from '../components/vocabulary-list-row';

const route = getRouteApi('/_auth/vocabulary-lists');

export const VocabularyListsPage: FC = () => {
  const lists = route.useLoaderData();

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
