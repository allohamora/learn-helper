import { useMutation } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import { type FC } from 'react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { track } from '@amplitude/analytics-browser';

export type NextStepProps = {
  userWordId: number;
};

export const NextStep: FC<NextStepProps> = ({ userWordId }) => {
  const { toast } = useToast();

  const moveUserWordToNextStep = useMutation({
    mutationFn: async (data: { userWordId: number }) => {
      track('move_word_to_next_step', data);

      return await actions.moveUserWordToNextStep(data);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to move word to next step',
        variant: 'destructive',
      });
    },
  });

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => moveUserWordToNextStep.mutate({ userWordId })}
      disabled={moveUserWordToNextStep.isPending || moveUserWordToNextStep.isSuccess}
      className="size-8 p-0"
    >
      {moveUserWordToNextStep.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : moveUserWordToNextStep.isSuccess ? (
        <Check className="size-4 text-green-600" />
      ) : (
        <ArrowRight className="size-4" />
      )}
    </Button>
  );
};
