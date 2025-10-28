import {
  getDiscoveryPerDayStatistics,
  getDurationPerDayStatistics,
  getTopMistakes,
  getTypeStatistics,
  insertEvents,
} from '@/repositories/event.repository';
import type { AuthParams } from '@/types/auth.types';
import type { EventBody } from '@/types/event.types';

export const createEvents = async (input: AuthParams<{ body: EventBody[] }>) => {
  const events = input.body.map((event) => ({
    userId: input.userId,
    ...event,
  }));

  await insertEvents(events);
};

export const getStatistics = async (data: AuthParams<{ dateFrom: Date; dateTo: Date }>) => {
  const [typeStatistics, durationPerDayStatistics, discoveryPerDayStatistics, topMistakes] = await Promise.all([
    getTypeStatistics(data),
    getDurationPerDayStatistics(data),
    getDiscoveryPerDayStatistics(data),
    getTopMistakes(data),
  ]);

  return {
    typeStatistics,
    durationPerDayStatistics,
    discoveryPerDayStatistics,
    topMistakes,
  };
};
