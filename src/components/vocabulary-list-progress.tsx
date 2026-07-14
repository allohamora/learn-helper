import type { FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { appClient } from '@/services/api';

type Props = {
  userVocabularyListId: string;
};

export const VocabularyListProgress: FC<Props> = ({ userVocabularyListId }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vocabulary-list-progress', userVocabularyListId],
    queryFn: async () => {
      const res = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].progress.$get({
        param: { userVocabularyListId },
      });
      if (!res.ok) throw new Error('Failed to load vocabulary list progress');

      const body = await res.json();
      return body.data;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !data) return null;

  const completed = data.learned + data.known;
  const percent = data.total > 0 ? Math.round((completed / data.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {completed} of {data.total} learned
      </p>
      <Progress value={percent} />
    </div>
  );
};
