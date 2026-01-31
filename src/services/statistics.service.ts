import { getGroupedByDayDiscoveryEvents, getGroupedByTypeEvents } from '@/repositories/event.repository';
import type { AuthParams } from '@/types/auth.types';
import { EventType } from '@/types/event.types';
import type { DiscoveringPerDayStatistics, Statistics } from '@/types/statistics.types';
import { Status } from '@/types/user-words.types';
import { daysAgo, endOfDay, startOfDay, toDateOnlyString } from '@/utils/date.utils';

const getGeneralStatistics = async (data: AuthParams) => {
  const result: Statistics['general'] = {
    totalDiscoveredWords: 0,
    totalWordsMovedToNextStep: 0,
    totalDiscoveringDurationMs: 0,
    averageTimePerDiscoveryMs: 0,
  };

  const groupedByTypeEvents = await getGroupedByTypeEvents(data);

  for (const item of groupedByTypeEvents) {
    switch (item.type) {
      case EventType.WordDiscovered:
        if (item.durationMs === null) {
          throw new Error(`DurationMs is null for WordDiscovered event: ${JSON.stringify(item)}`);
        }

        result.totalDiscoveredWords = item.count;
        result.totalDiscoveringDurationMs = item.durationMs;
        result.averageTimePerDiscoveryMs = Math.round(item.durationMs / item.count);
        continue;
      case EventType.WordMovedToNextStep:
        result.totalWordsMovedToNextStep = item.count;
        continue;
      default:
        throw new Error(`Unknown event type: ${item.type}`);
    }
  }

  return result;
};

const getDates = ({ dateTo, dateFrom }: { dateTo: Date; dateFrom: Date }) => {
  const dates: string[] = [];
  const currentDate = new Date(dateFrom);

  while (currentDate.getTime() <= dateTo.getTime()) {
    dates.push(toDateOnlyString(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

const getDiscoveringPerDayStatistics = async (data: AuthParams<{ dateTo: Date; dateFrom: Date }>) => {
  const state = getDates(data).reduce(
    (state, date) => ({ ...state, [date]: { date, learningCount: 0, knownCount: 0, durationMs: 0 } }),
    {} as Record<string, DiscoveringPerDayStatistics>,
  );

  const groupedByDayDiscoveryEvents = await getGroupedByDayDiscoveryEvents(data);
  for (const item of groupedByDayDiscoveryEvents) {
    const target = state[item.date];
    if (!target) {
      throw new Error(`Date ${item.date} is missing in the state`);
    }

    if (item.durationMs === null) {
      throw new Error(`DurationMs is null for discovery event: ${JSON.stringify(item)}`);
    }

    target.durationMs += item.durationMs;

    switch (item.status) {
      case Status.Learning:
        target.learningCount = item.count;
        continue;
      case Status.Known:
        target.knownCount = item.count;
        continue;
      default:
        throw new Error(`Unknown discovery status: ${item.status}`);
    }
  }

  return Object.values(state);
};

export const getStatistics = async ({ userId }: AuthParams) => {
  const dateTo = endOfDay(new Date());
  const dateFrom = daysAgo(6, startOfDay(dateTo));
  const data = { userId, dateFrom, dateTo };

  const [general, discoveringPerDay] = await Promise.all([
    getGeneralStatistics(data),
    getDiscoveringPerDayStatistics(data),
  ]);

  return {
    general,
    discoveringPerDay,
  } satisfies Statistics;
};
