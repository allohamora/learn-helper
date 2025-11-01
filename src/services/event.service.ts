import { insertEvents } from '@/repositories/event.repository';
import type { AuthParams } from '@/types/auth.types';
import type { EventBody } from '@/types/event.types';

export const createEvents = async (input: AuthParams<{ body: EventBody[] }>) => {
  const events = input.body.map((event) => ({
    userId: input.userId,
    ...event,
  }));

  await insertEvents(events);
};
