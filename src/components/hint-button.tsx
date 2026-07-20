import { type FC } from 'react';
import { CircleQuestionMarkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EventType, type UserVocabularyItemTaskType } from '@/const/event';
import { useCreateVocabularyListEvents } from '@/hooks/use-create-vocabulary-list-events';
import { cn } from '@/lib/utils';

type HintButtonProps = {
  hint: string;
  userVocabularyListId: string;
  userVocabularyItemId: string;
  taskType: UserVocabularyItemTaskType;
  className?: string;
};

export const HintButton: FC<HintButtonProps> = ({
  hint,
  userVocabularyListId,
  userVocabularyItemId,
  taskType,
  className,
}) => {
  const { createEvent } = useCreateVocabularyListEvents(userVocabularyListId);

  const handleClick = () => {
    toast.info('Hint', { description: hint });
    createEvent({
      type: EventType.UserVocabularyItemTaskHintUsed,
      userVocabularyItemId,
      userVocabularyItemTaskType: taskType,
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn('size-6 cursor-pointer', className)}
      title={hint}
      aria-label="Show hint"
      onClick={handleClick}
    >
      <CircleQuestionMarkIcon className="size-4" />
    </Button>
  );
};
