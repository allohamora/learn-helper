import type { InferResponseType } from 'hono/client';
import { UserVocabularyItemTaskType } from '@/const/event';
import { appClient } from '@/services/api';

type LearningItemsResponse = InferResponseType<
  (typeof appClient.api.v1.users.me)['vocabulary-lists'][':userVocabularyListId']['learning-items']['$get']
>;

export type LearningItem = Extract<LearningItemsResponse, { success: true }>['data'][number];

type LearningTasksResponse = InferResponseType<
  (typeof appClient.api.v1.users.me)['vocabulary-lists'][':userVocabularyListId']['learning-tasks']['$get']
>;

export type LearningTasksData = Extract<LearningTasksResponse, { success: true }>['data'];

export type ToVocabularyItemData = {
  id: string;
  vocabularyItem: string;
  hint?: string;
};

export type TextToVocabularyItemData = ToVocabularyItemData & {
  text: string;
};

export type ToOptionsData = {
  id: string;
  options: Array<{
    value: string;
    isAnswer: boolean;
    description?: string;
  }>;
  hint?: string;
};

export type VocabularyItemToOptionsData = ToOptionsData & LearningItem['vocabularyItem'];

export type WordArrangementData = {
  id: string;
  sentence: string;
  originalWords: string[];
  shuffledWords: string[];
};

export type ShowcaseTask = {
  id: string;
  type: UserVocabularyItemTaskType.Showcase;
  data: LearningItem['vocabularyItem'] & { id: string };
};

export type VocabularyItemToDefinitionTask = {
  id: string;
  type: UserVocabularyItemTaskType.VocabularyItemToDefinition;
  data: VocabularyItemToOptionsData;
};

export type DefinitionToVocabularyItemTask = {
  id: string;
  type: UserVocabularyItemTaskType.DefinitionToVocabularyItem;
  data: TextToVocabularyItemData;
};

export type VocabularyItemToTranslationTask = {
  id: string;
  type: UserVocabularyItemTaskType.VocabularyItemToTranslation;
  data: VocabularyItemToOptionsData;
};

export type TranslationToVocabularyItemTask = {
  id: string;
  type: UserVocabularyItemTaskType.TranslationToVocabularyItem;
  data: TextToVocabularyItemData;
};

export type PronunciationToVocabularyItemTask = {
  id: string;
  type: UserVocabularyItemTaskType.PronunciationToVocabularyItem;
  data: ToVocabularyItemData & {
    pronunciation: string;
    spelling: string;
  };
};

export type TranslateEnglishSentenceTask = {
  id: string;
  type: UserVocabularyItemTaskType.TranslateEnglishSentence;
  data: WordArrangementData;
};

export type TranslateUkrainianSentenceTask = {
  id: string;
  type: UserVocabularyItemTaskType.TranslateUkrainianSentence;
  data: WordArrangementData;
};

export type LearningTask =
  | ShowcaseTask
  | VocabularyItemToDefinitionTask
  | DefinitionToVocabularyItemTask
  | VocabularyItemToTranslationTask
  | TranslationToVocabularyItemTask
  | PronunciationToVocabularyItemTask
  | TranslateEnglishSentenceTask
  | TranslateUkrainianSentenceTask;
