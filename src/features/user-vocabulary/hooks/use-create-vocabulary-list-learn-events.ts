import type { InferRequestType } from 'hono/client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiRequest, appClient } from '@/services/api';

type CreateVocabularyListLearnEventsEndpoint =
  (typeof appClient.api.v1.users.me)['vocabulary-lists'][':userVocabularyListId']['learn']['events']['$post'];
type CreateVocabularyListLearnEventsRequest = InferRequestType<CreateVocabularyListLearnEventsEndpoint>;
export type ClientVocabularyListLearnEvent = CreateVocabularyListLearnEventsRequest['json']['events'][number];

export const useCreateVocabularyListLearnEvents = (userVocabularyListId: string) => {
  const mutation = useMutation({
    mutationFn: (events: ClientVocabularyListLearnEvent[]) =>
      apiRequest(
        () =>
          appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.events.$post({
            param: { userVocabularyListId },
            json: { events },
          }),
        'Failed to create vocabulary list learn events',
      ),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to save Learn progress'),
  });

  return {
    ...mutation,
    createVocabularyListLearnEvents: (events: ClientVocabularyListLearnEvent[]) => mutation.mutate(events),
    createVocabularyListLearnEvent: (event: ClientVocabularyListLearnEvent) => mutation.mutate([event]),
  };
};
