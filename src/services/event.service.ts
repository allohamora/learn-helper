import {
  getDiscoveryStatistics,
  getDurationStatistics,
  getTopMistakes,
  getTypeStatistics,
  insertEvents,
} from '@/repositories/event.repository';
import type { AuthParams } from '@/types/auth.types';
import type { EventBody } from '@/types/user-words.types';

export const createEvents = async (input: AuthParams<{ body: EventBody[] }>) => {
  const events = input.body.map((event) => ({
    userId: input.userId,
    ...event,
  }));

  await insertEvents(events);
};

export const getStatistics = async (data: AuthParams<{ dateFrom: Date; dateTo: Date }>) => {
  const [typeStatistics, durationStatistics, discoveryStatistics, topMistakes] = await Promise.all([
    getTypeStatistics(data),
    getDurationStatistics(data),
    getDiscoveryStatistics(data),
    getTopMistakes(data),
  ]);

  return {
    typeStatistics,
    durationStatistics,
    discoveryStatistics,
    topMistakes,
  };
};
