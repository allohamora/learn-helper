import type { FC } from 'react';
import { Progress } from '@/components/ui/progress';

type Props = {
  total: number;
  learned: number;
  known: number;
};

export const VocabularyListProgress: FC<Props> = ({ total, learned, known }) => {
  const completed = learned + known;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {completed} of {total} learned
      </p>
      <Progress value={percent} />
    </div>
  );
};
