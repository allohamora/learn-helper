import type { InferRequestType } from 'hono/client';
import { useMutation } from '@tanstack/react-query';
import { appClient } from '@/services/api';

type CreateVocabularyListLearningEventsEndpoint =
  (typeof appClient.api.v1.users.me)['vocabulary-lists'][':userVocabularyListId']['events']['$post'];
type CreateVocabularyListLearningEventsRequest = InferRequestType<CreateVocabularyListLearningEventsEndpoint>;
export type ClientVocabularyListLearningEvent = CreateVocabularyListLearningEventsRequest['json']['events'][number];

export const useCreateVocabularyListLearningEvents = (userVocabularyListId: string) => {
  const mutation = useMutation({
    mutationFn: async (events: ClientVocabularyListLearningEvent[]) => {
      const res = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].events.$post({
        param: { userVocabularyListId },
        json: { events },
      });
      if (!res.ok) throw new Error('Failed to create vocabulary list learning events');

      return res.json();
    },
  });

  return {
    ...mutation,
    createVocabularyListLearningEvents: (events: ClientVocabularyListLearningEvent[]) => mutation.mutate(events),
    createVocabularyListLearningEvent: (event: ClientVocabularyListLearningEvent) => mutation.mutate([event]),
  };
};
