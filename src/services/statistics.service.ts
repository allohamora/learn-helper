import {
  getGroupedByDayDiscoveryEvents,
  getGroupedByDayLearningEvents,
  getGroupedByTypeEvents,
  getTopMistakes,
} from '@/repositories/event.repository';
import type { AuthParams } from '@/types/auth.types';
import { EventType } from '@/types/event.types';
import type { DiscoveringPerDayStatistics, LearningPerDayStatistics, Statistics } from '@/types/statistics.types';
import { Status } from '@/types/user-words.types';
import { daysAgo, toDateOnlyString } from '@/utils/date.utils';

const getGeneralStatistics = async (data: AuthParams) => {
  const result: Statistics['general'] = {
    totalDiscoveredWords: 0,
    totalMistakesMade: 0,
    totalCompletedTasks: 0,
    totalRetriesCompleted: 0,
    totalShowcasesCompleted: 0,
    totalWordsMovedToNextStep: 0,

    totalLearningDurationMs: 0,
    totalDiscoveringDurationMs: 0,

    averageTimePerTaskMs: 0,
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
      case EventType.LearningMistakeMade:
        result.totalMistakesMade = item.count;
        continue;
      case EventType.LearningTaskCompleted:
        if (item.durationMs === null) {
          throw new Error(`DurationMs is null for LearningTaskCompleted event: ${JSON.stringify(item)}`);
        }

        result.totalCompletedTasks = item.count;
        result.totalLearningDurationMs += item.durationMs;
        result.averageTimePerTaskMs = Math.round(item.durationMs / item.count);
        continue;
      case EventType.ShowcaseTaskCompleted:
        if (item.durationMs === null) {
          throw new Error(`DurationMs is null for ShowcaseTaskCompleted event: ${JSON.stringify(item)}`);
        }

        result.totalShowcasesCompleted = item.count;
        result.totalLearningDurationMs += item.durationMs;
        continue;
      case EventType.RetryLearningTaskCompleted:
        if (item.durationMs === null) {
          throw new Error(`DurationMs is null for RetryLearningTaskCompleted event: ${JSON.stringify(item)}`);
        }

        result.totalRetriesCompleted = item.count;
        result.totalLearningDurationMs += item.durationMs;
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

  while (currentDate <= dateTo) {
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

const getLearningPerDayStatistics = async (data: AuthParams<{ dateTo: Date; dateFrom: Date }>) => {
  const state = getDates(data).reduce(
    (state, date) => ({
      ...state,
      [date]: {
        date,
        completedTasks: 0,
        completedRetries: 0,
        completedShowcases: 0,
        mistakesMade: 0,
        durationMs: 0,
      },
    }),
    {} as Record<string, LearningPerDayStatistics>,
  );

  const groupedByDayLearningEvents = await getGroupedByDayLearningEvents(data);
  for (const item of groupedByDayLearningEvents) {
    const target = state[item.date];
    if (!target) {
      throw new Error(`Date ${item.date} is missing in the state`);
    }

    switch (item.type) {
      case EventType.LearningTaskCompleted:
        if (item.durationMs === null) {
          throw new Error(`DurationMs is null for learning event: ${JSON.stringify(item)}`);
        }

        target.completedTasks = item.count;
        target.durationMs += item.durationMs;
        continue;
      case EventType.ShowcaseTaskCompleted:
        if (item.durationMs === null) {
          throw new Error(`DurationMs is null for learning event: ${JSON.stringify(item)}`);
        }

        target.completedShowcases = item.count;
        target.durationMs += item.durationMs;
        continue;
      case EventType.RetryLearningTaskCompleted:
        if (item.durationMs === null) {
          throw new Error(`DurationMs is null for learning event: ${JSON.stringify(item)}`);
        }

        target.completedRetries = item.count;
        target.durationMs += item.durationMs;
        continue;
      case EventType.LearningMistakeMade:
        target.mistakesMade = item.count;
        continue;
      default:
        throw new Error(`Unknown learning event type: ${item.type}`);
    }
  }

  return Object.values(state);
};

export const getStatistics = async ({ userId }: AuthParams) => {
  const dateTo = new Date();
  const dateFrom = daysAgo(6);
  const data = { userId, dateFrom, dateTo };

  const [general, discoveringPerDay, learningPerDay, topMistakes] = await Promise.all([
    getGeneralStatistics(data),
    getDiscoveringPerDayStatistics(data),
    getLearningPerDayStatistics(data),
    getTopMistakes({ userId, limit: 20 }),
  ]);

  return {
    general,
    discoveringPerDay,
    learningPerDay,
    topMistakes,
  } satisfies Statistics;
};
