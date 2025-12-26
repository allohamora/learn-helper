import type { ClientEventBody } from '@/types/event.types';
import { useMutation } from '@tanstack/react-query';
import { actions } from 'astro:actions';

export const useCreateEvents = () => {
  const mutation = useMutation({
    mutationFn: async (body: ClientEventBody[]) => {
      await actions.createEvents.orThrow({ body });
    },
  });

  const createEvents = (body: ClientEventBody[]) => {
    mutation.mutate(body);
  };

  const createEvent = (event: ClientEventBody) => {
    mutation.mutate([event]);
  };

  return {
    ...mutation,
    createEvents,
    createEvent,
  };
};
