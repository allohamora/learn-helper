import type { EventBody } from '@/types/user-words.types';
import { useMutation } from '@tanstack/react-query';
import { actions } from 'astro:actions';

export const useCreateEvents = () => {
  const mutation = useMutation({
    mutationFn: async (body: EventBody[]) => {
      await actions.createEvents.orThrow({ body });
    },
  });

  const createEvents = (body: EventBody[]) => {
    mutation.mutate(body);
  };

  const createEvent = (event: EventBody) => {
    mutation.mutate([event]);
  };

  return {
    ...mutation,
    createEvents,
    createEvent,
  };
};
