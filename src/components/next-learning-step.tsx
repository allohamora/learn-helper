import { type FC } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { appClient } from '@/services/api';
import { Button } from './ui/button';

export type NextLearningStepProps = {
  userVocabularyListId: string;
  userVocabularyItemId: string;
};

export const NextLearningStep: FC<NextLearningStepProps> = ({ userVocabularyListId, userVocabularyItemId }) => {
  const queryClient = useQueryClient();
  const moveVocabularyItemToNextStep = useMutation({
    mutationFn: async () => {
      const response = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ]['move-to-next-step'].$post({ param: { userVocabularyListId, userVocabularyItemId } });
      if (!response.ok) throw new Error('Failed to move vocabulary item to next step');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-items'] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-progress'] });
    },
    onError: () => toast.error('Failed to move vocabulary item to next step'),
  });

  const label = moveVocabularyItemToNextStep.isPending
    ? 'Moving to next step'
    : moveVocabularyItemToNextStep.isSuccess
      ? 'Moved to next step'
      : 'Move to next step';

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => moveVocabularyItemToNextStep.mutate()}
      disabled={moveVocabularyItemToNextStep.isPending || moveVocabularyItemToNextStep.isSuccess}
      className="size-8 p-0"
      title={label}
      aria-label={label}
    >
      {moveVocabularyItemToNextStep.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : moveVocabularyItemToNextStep.isSuccess ? (
        <Check className="size-4 text-green-600" />
      ) : (
        <ArrowRight className="size-4" />
      )}
    </Button>
  );
};
