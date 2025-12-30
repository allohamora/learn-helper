import { type FC } from 'react';
import { Button } from '@/components/ui/button';
import { CircleQuestionMarkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCreateEvents } from '@/hooks/use-create-events';
import { EventType } from '@/types/event.types';
import { type TaskType } from '@/types/user-words.types';
import { cn } from '@/lib/utils';

type HintButtonProps = {
  hint: string;
  userWordId: number;
  taskType: TaskType;
  className?: string;
};

export const HintButton: FC<HintButtonProps> = ({ hint, userWordId, taskType, className }) => {
  const { toast } = useToast();
  const { createEvent } = useCreateEvents();

  const handleClick = () => {
    toast({ title: 'Hint', description: hint, variant: 'default' });
    createEvent({ type: EventType.HintViewed, userWordId, taskType, hint });
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
