import type { FC } from 'react';
import { BookOpen, Compass, List, Plus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { appClient } from '@/services/api';

type Props = {
  id: string | null;
  vocabularyListId: string;
  title: string;
  addedAt: string | null;
};

export const VocabularyListRow: FC<Props> = ({ id, vocabularyListId, title }) => {
  const router = useRouter();

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await appClient.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId } });
      if (!res.ok) throw new Error('Failed to add vocabulary list');
    },
    onSuccess: () => router.invalidate(),
  });

  return (
    <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:gap-4">
      <div className="min-w-0">
        <h2 className="line-clamp-2 text-sm leading-5 font-medium text-balance sm:text-base">{title}</h2>
      </div>

      {id ? (
        <div className="flex shrink-0 items-center justify-end gap-2 justify-self-end">
          <Button
            size="sm"
            variant="outline"
            className="size-8 px-0 sm:w-auto sm:px-2.5"
            asChild
            title="View items"
            aria-label="View items"
          >
            <Link to="/vocabulary/$userVocabularyListId" params={{ userVocabularyListId: id }}>
              <List />
              <span className="hidden sm:inline">Items</span>
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="size-8 px-0 sm:w-auto sm:px-2.5"
            asChild
            title="Learn"
            aria-label="Learn"
          >
            <Link to="/vocabulary/$userVocabularyListId/learning" params={{ userVocabularyListId: id }}>
              <BookOpen />
              <span className="hidden sm:inline">Learn</span>
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="size-8 px-0 sm:w-auto sm:px-2.5"
            asChild
            title="Discovery"
            aria-label="Discovery"
          >
            <Link to="/vocabulary/$userVocabularyListId/discovery" params={{ userVocabularyListId: id }}>
              <Compass />
              <span className="hidden sm:inline">Discovery</span>
            </Link>
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending}
          title="Add to my vocabulary"
          aria-label="Add to my vocabulary"
          className="size-8 justify-self-end px-0 sm:w-auto sm:px-2.5"
        >
          <Plus />
          <span className="hidden sm:inline">Add</span>
        </Button>
      )}
    </div>
  );
};
