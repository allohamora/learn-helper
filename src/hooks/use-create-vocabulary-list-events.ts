import type { InferRequestType } from 'hono/client';
import { useMutation } from '@tanstack/react-query';
import { appClient } from '@/services/api';

type CreateVocabularyListEventsEndpoint =
  (typeof appClient.api.v1.users.me)['vocabulary-lists'][':userVocabularyListId']['events']['$post'];
type CreateVocabularyListEventsRequest = InferRequestType<CreateVocabularyListEventsEndpoint>;
export type ClientVocabularyListEvent = CreateVocabularyListEventsRequest['json']['events'][number];

export const useCreateVocabularyListEvents = (userVocabularyListId: string) => {
  const mutation = useMutation({
    mutationFn: async (events: ClientVocabularyListEvent[]) => {
      const res = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].events.$post({
        param: { userVocabularyListId },
        json: { events },
      });
      if (!res.ok) throw new Error('Failed to create vocabulary list events');

      return res.json();
    },
  });

  return {
    ...mutation,
    createEvents: (events: ClientVocabularyListEvent[]) => mutation.mutate(events),
    createEvent: (event: ClientVocabularyListEvent) => mutation.mutate([event]),
  };
};
