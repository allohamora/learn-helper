import type { FC } from 'react';
import { BookOpen, Compass, List, Plus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { apiRequest, appClient } from '@/services/api';
import { VocabularyListType } from '@/const/vocabulary';
import { getVocabularyListTitle } from '@/utils/vocabulary';

type Props = {
  id: string;
  title: string | null;
  type: VocabularyListType;
  userVocabularyList: {
    id: string;
  } | null;
};

export const VocabularyListRow: FC<Props> = ({ id, title, type, userVocabularyList }) => {
  const router = useRouter();

  const addMutation = useMutation({
    mutationFn: () =>
      apiRequest(
        () => appClient.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: id } }),
        'Failed to add vocabulary list',
      ),
    onSuccess: () => router.invalidate(),
  });

  return (
    <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:gap-4">
      <div className="min-w-0">
        <h2 className="line-clamp-2 text-sm/5 font-medium text-balance sm:text-base">
          {getVocabularyListTitle({ type, title })}
        </h2>
      </div>

      {userVocabularyList ? (
        <div className="flex shrink-0 items-center justify-end gap-2 justify-self-end">
          <Button
            size="sm"
            variant="outline"
            className="size-8 px-0 sm:w-auto sm:px-2.5"
            asChild
            title="View items"
            aria-label="View items"
          >
            <Link to="/vocabulary-lists/$userVocabularyListId" params={{ userVocabularyListId: userVocabularyList.id }}>
              <List />
              <span className="hidden sm:inline">Items</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="size-8 px-0 sm:w-auto sm:px-2.5"
              asChild
              title="Learn"
              aria-label="Learn"
            >
              <Link
                to="/vocabulary-lists/$userVocabularyListId/learn"
                params={{ userVocabularyListId: userVocabularyList.id }}
              >
                <BookOpen />
                <span className="hidden sm:inline">Learn</span>
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="size-8 px-0 sm:w-auto sm:px-2.5"
              asChild
              title="Discover"
              aria-label="Discover"
            >
              <Link
                to="/vocabulary-lists/$userVocabularyListId/discover"
                params={{ userVocabularyListId: userVocabularyList.id }}
              >
                <Compass />
                <span className="hidden sm:inline">Discover</span>
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending}
          title="Add vocabulary list"
          aria-label="Add vocabulary list"
          className="size-8 justify-self-end px-0 sm:w-auto sm:px-2.5"
        >
          <Plus />
          <span className="hidden sm:inline">Add</span>
        </Button>
      )}
    </div>
  );
};
