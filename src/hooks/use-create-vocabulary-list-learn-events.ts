import type { InferRequestType } from 'hono/client';
import { useMutation } from '@tanstack/react-query';
import { appClient } from '@/services/api';

type CreateVocabularyListLearnEventsEndpoint =
  (typeof appClient.api.v1.users.me)['vocabulary-lists'][':userVocabularyListId']['learn']['events']['$post'];
type CreateVocabularyListLearnEventsRequest = InferRequestType<CreateVocabularyListLearnEventsEndpoint>;
export type ClientVocabularyListLearnEvent = CreateVocabularyListLearnEventsRequest['json']['events'][number];

export const useCreateVocabularyListLearnEvents = (userVocabularyListId: string) => {
  const mutation = useMutation({
    mutationFn: async (events: ClientVocabularyListLearnEvent[]) => {
      const res = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.events.$post({
        param: { userVocabularyListId },
        json: { events },
      });
      if (!res.ok) throw new Error('Failed to create vocabulary list Learn events');

      return res.json();
    },
  });

  return {
    ...mutation,
    createVocabularyListLearnEvents: (events: ClientVocabularyListLearnEvent[]) => mutation.mutate(events),
    createVocabularyListLearnEvent: (event: ClientVocabularyListLearnEvent) => mutation.mutate([event]),
  };
};
