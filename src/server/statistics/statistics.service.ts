import '@tanstack/react-start/server-only';
import { tz } from '@date-fns/tz';
import { eachDayOfInterval, endOfDay, format, startOfDay, subDays } from 'date-fns';
import { EventType } from '@/const/event';
import { LearningStatus } from '@/const/vocabulary';
import {
  getDiscoveryEventsGroupedByDay,
  getEventsGroupedByType,
  getLearningEventsGroupedByDay,
  getTaskGenerationEventsGroupedByDay,
  getTopHintedVocabularyItems,
  getTopMistakes,
  getVocabularyItemUpdatedEventsGroupedByDay,
} from '../event/event.repository';
import type {
  CostPerDayStatistics,
  DiscoveringPerDayStatistics,
  LearningPerDayStatistics,
  Statistics,
  WordsUpdatedPerDayStatistics,
} from './dtos/statistics.dto';

type DailyStatisticsDto = {
  userId: string;
  dateFrom: Date;
  dateTo: Date;
  timezone: string;
};

const getDates = ({ dateFrom, dateTo, timezone }: Omit<DailyStatisticsDto, 'userId'>) => {
  return eachDayOfInterval({ start: dateFrom, end: dateTo }, { in: tz(timezone) }).map((date) =>
    format(date, 'yyyy-MM-dd', { in: tz(timezone) }),
  );
};

const getGeneralStatistics = async (userId: string) => {
  const result: Statistics['general'] = {
    totalDiscoveredWords: 0,
    totalDiscoveryUndos: 0,
    totalMistakesMade: 0,
    totalCompletedTasks: 0,
    totalRetriesCompleted: 0,
    totalShowcasesCompleted: 0,
    totalWordsMovedToNextStep: 0,
    totalHintsViewed: 0,
    totalWordsUpdated: 0,
    totalWordsGenerated: 0,
    totalAiCostsInNanoDollars: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalLearningDurationMs: 0,
    totalDiscoveringDurationMs: 0,
    averageTimePerTaskMs: 0,
    averageTimePerDiscoveryMs: 0,
  };

  const groupedEvents = await getEventsGroupedByType({ userId });

  for (const item of groupedEvents) {
    switch (item.type) {
      case EventType.UserVocabularyItemDiscovered:
        if (item.durationMs === null) {
          throw new Error(`DurationMs is null for discovery events: ${JSON.stringify(item)}`);
        }

        result.totalDiscoveredWords = item.count;
        result.totalDiscoveringDurationMs = item.durationMs;
        result.averageTimePerDiscoveryMs = Math.round(item.durationMs / item.count);
        continue;
      case EventType.UserVocabularyItemTaskFailed:
        result.totalMistakesMade = item.count;
        continue;
      case EventType.UserVocabularyItemTaskPassed:
        if (item.durationMs === null) {
          throw new Error(`DurationMs is null for passed task events: ${JSON.stringify(item)}`);
        }

        result.totalCompletedTasks = item.count;
        result.totalLearningDurationMs += item.durationMs;
        result.averageTimePerTaskMs = Math.round(item.durationMs / item.count);
        continue;
      case EventType.UserVocabularyItemTaskShowcaseViewed:
        if (item.durationMs === null) {
          throw new Error(`DurationMs is null for showcase events: ${JSON.stringify(item)}`);
        }

        result.totalShowcasesCompleted = item.count;
        result.totalLearningDurationMs += item.durationMs;
        continue;
      case EventType.UserVocabularyItemTaskRetryPassed:
        if (item.durationMs === null) {
          throw new Error(`DurationMs is null for retry events: ${JSON.stringify(item)}`);
        }

        result.totalRetriesCompleted = item.count;
        result.totalLearningDurationMs += item.durationMs;
        continue;
      case EventType.UserVocabularyItemMovedToNextStep:
        result.totalWordsMovedToNextStep = item.count;
        continue;
      case EventType.UserVocabularyItemTaskHintUsed:
        result.totalHintsViewed = item.count;
        continue;
      case EventType.VocabularyItemUpdated:
        result.totalWordsUpdated = item.count;
        continue;
      case EventType.UserVocabularyItemTaskGenerated:
        if (item.costInNanoDollars === null) {
          throw new Error(`CostInNanoDollars is null for task generation events: ${JSON.stringify(item)}`);
        }

        result.totalAiCostsInNanoDollars += item.costInNanoDollars;
        result.totalInputTokens += item.inputTokens ?? 0;
        result.totalOutputTokens += item.outputTokens ?? 0;
        continue;
      case EventType.UserVocabularyItemDiscoveryUndone:
        result.totalDiscoveryUndos = item.count;
        continue;
      case EventType.VocabularyItemGenerated:
        if (item.costInNanoDollars === null) {
          throw new Error(`CostInNanoDollars is null for word generation events: ${JSON.stringify(item)}`);
        }

        result.totalWordsGenerated = item.count;
        result.totalAiCostsInNanoDollars += item.costInNanoDollars;
        result.totalInputTokens += item.inputTokens ?? 0;
        result.totalOutputTokens += item.outputTokens ?? 0;
        continue;
    }
  }

  return result;
};

const getDiscoveringPerDayStatistics = async ({ userId, dateFrom, dateTo, timezone }: DailyStatisticsDto) => {
  const state = getDates({ dateFrom, dateTo, timezone }).reduce(
    (result, date) => ({ ...result, [date]: { date, learningCount: 0, knownCount: 0, durationMs: 0 } }),
    {} as Record<string, DiscoveringPerDayStatistics>,
  );

  const events = await getDiscoveryEventsGroupedByDay({ userId, dateFrom, dateTo, timezone });
  for (const item of events) {
    const target = state[item.date];
    if (!target) throw new Error(`Date ${item.date} is missing in discovery statistics`);
    if (item.durationMs === null) throw new Error(`DurationMs is null for discovery events: ${JSON.stringify(item)}`);

    target.durationMs += item.durationMs;

    switch (item.status) {
      case LearningStatus.Learning:
        target.learningCount = item.count;
        continue;
      case LearningStatus.Known:
        target.knownCount = item.count;
        continue;
      default:
        throw new Error(`Unknown discovery status: ${item.status}`);
    }
  }

  return Object.values(state);
};

const getLearningPerDayStatistics = async ({ userId, dateFrom, dateTo, timezone }: DailyStatisticsDto) => {
  const state = getDates({ dateFrom, dateTo, timezone }).reduce(
    (result, date) => ({
      ...result,
      [date]: {
        date,
        completedTasks: 0,
        completedRetries: 0,
        completedShowcases: 0,
        mistakesMade: 0,
        hintsViewed: 0,
        durationMs: 0,
      },
    }),
    {} as Record<string, LearningPerDayStatistics>,
  );

  const events = await getLearningEventsGroupedByDay({ userId, dateFrom, dateTo, timezone });
  for (const item of events) {
    const target = state[item.date];
    if (!target) throw new Error(`Date ${item.date} is missing in learning statistics`);

    switch (item.type) {
      case EventType.UserVocabularyItemTaskPassed:
        if (item.durationMs === null)
          throw new Error(`DurationMs is null for learning events: ${JSON.stringify(item)}`);
        target.completedTasks = item.count;
        target.durationMs += item.durationMs;
        continue;
      case EventType.UserVocabularyItemTaskRetryPassed:
        if (item.durationMs === null)
          throw new Error(`DurationMs is null for learning events: ${JSON.stringify(item)}`);
        target.completedRetries = item.count;
        target.durationMs += item.durationMs;
        continue;
      case EventType.UserVocabularyItemTaskShowcaseViewed:
        if (item.durationMs === null)
          throw new Error(`DurationMs is null for learning events: ${JSON.stringify(item)}`);
        target.completedShowcases = item.count;
        target.durationMs += item.durationMs;
        continue;
      case EventType.UserVocabularyItemTaskFailed:
        target.mistakesMade = item.count;
        continue;
      case EventType.UserVocabularyItemTaskHintUsed:
        target.hintsViewed = item.count;
        continue;
      default:
        throw new Error(`Unknown learning event type: ${item.type}`);
    }
  }

  return Object.values(state);
};

const getCostPerDayStatistics = async ({ userId, dateFrom, dateTo, timezone }: DailyStatisticsDto) => {
  const state = getDates({ dateFrom, dateTo, timezone }).reduce(
    (result, date) => ({ ...result, [date]: { date, costInNanoDollars: 0, inputTokens: 0, outputTokens: 0 } }),
    {} as Record<string, CostPerDayStatistics>,
  );

  const events = await getTaskGenerationEventsGroupedByDay({ userId, dateFrom, dateTo, timezone });
  for (const item of events) {
    const target = state[item.date];
    if (!target) throw new Error(`Date ${item.date} is missing in cost statistics`);
    if (item.costInNanoDollars === null) {
      throw new Error(`CostInNanoDollars is null for task generation events: ${JSON.stringify(item)}`);
    }

    target.costInNanoDollars += item.costInNanoDollars;
    target.inputTokens += item.inputTokens ?? 0;
    target.outputTokens += item.outputTokens ?? 0;
  }

  return Object.values(state);
};

const getWordsUpdatedPerDayStatistics = async ({ userId, dateFrom, dateTo, timezone }: DailyStatisticsDto) => {
  const state = getDates({ dateFrom, dateTo, timezone }).reduce(
    (result, date) => ({ ...result, [date]: { date, uaTranslation: 0 } }),
    {} as Record<string, WordsUpdatedPerDayStatistics>,
  );

  const events = await getVocabularyItemUpdatedEventsGroupedByDay({
    userId,
    dateFrom,
    dateTo,
    timezone,
  });
  for (const item of events) {
    const target = state[item.date];
    if (!target) throw new Error(`Date ${item.date} is missing in update statistics`);
    if (item.fieldName === 'uaTranslation') target.uaTranslation = item.count;
  }

  return Object.values(state);
};

export const getStatistics = async ({ userId, timezone = 'UTC' }: { userId: string; timezone?: string }) => {
  const dateTo = endOfDay(new Date(), { in: tz(timezone) });
  const dateFrom = subDays(startOfDay(dateTo, { in: tz(timezone) }), 6, { in: tz(timezone) });
  const range = { userId, dateFrom, dateTo, timezone };

  const [general, discoveringPerDay, learningPerDay, costPerDay, wordsUpdatedPerDay, topMistakes, topHintedWords] =
    await Promise.all([
      getGeneralStatistics(userId),
      getDiscoveringPerDayStatistics(range),
      getLearningPerDayStatistics(range),
      getCostPerDayStatistics(range),
      getWordsUpdatedPerDayStatistics(range),
      getTopMistakes({ userId, limit: 20 }),
      getTopHintedVocabularyItems({ userId, limit: 20 }),
    ]);

  return {
    general,
    discoveringPerDay,
    learningPerDay,
    costPerDay,
    wordsUpdatedPerDay,
    topMistakes,
    topHintedWords,
  } satisfies Statistics;
};
