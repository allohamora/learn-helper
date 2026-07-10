import type { FC } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LEARNING_STATUS_BG_CLASS, LEARNING_STATUS_LABEL, LearningStatus } from '@/const/vocabulary';

type Props = {
  status: LearningStatus;
  className?: string;
};

export const VocabularyStatusBadge: FC<Props> = ({ status, className }) => {
  return (
    <Badge variant="outline" className={cn('gap-1.5', className)}>
      <span className={cn('size-1.5 rounded-full', LEARNING_STATUS_BG_CLASS[status])} />
      {LEARNING_STATUS_LABEL[status]}
    </Badge>
  );
};
