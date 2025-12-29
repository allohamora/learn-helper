import { type FC } from 'react';
import { Button } from '@/components/ui/button';
import { CircleQuestionMarkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type HintButtonProps = {
  hint: string;
  className?: string;
};

export const HintButton: FC<HintButtonProps> = ({ hint, className }) => {
  const { toast } = useToast();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn('size-6 cursor-pointer', className)}
      title={hint}
      aria-label="Show hint"
      onClick={() => toast({ title: 'Hint', description: hint, variant: 'default' })}
    >
      <CircleQuestionMarkIcon className="size-4" />
    </Button>
  );
};
