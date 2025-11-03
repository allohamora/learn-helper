import type * as db from 'astro:db';

export enum Level {
  A1 = 'a1',
  A2 = 'a2',
  B1 = 'b1',
  B2 = 'b2',
  C1 = 'c1',
}

export enum List {
  Oxford5000Words = 'oxford-5000-words',
  OxfordPhraseList = 'oxford-phrase-list',
}

export enum Status {
  Waiting = 'waiting', // word is waiting to be assigned to learning or known
  Learning = 'learning', // first learning phase
  Learned = 'learned', // user successfully learned the word
  Known = 'known', // user already knew the word
}

export type DiscoveryStatus = typeof Status.Learning | typeof Status.Known | typeof Status.Waiting;

export type UserWord = { word: typeof db.Word.$inferSelect } & typeof db.UserWord.$inferSelect;

export enum TaskType {
  Showcase = 'showcase',
  WordToDefinition = 'word-to-definition',
  DefinitionToWord = 'definition-to-word',
  WordToTranslation = 'word-to-translation',
  TranslationToWord = 'translation-to-word',
  PronunciationToWord = 'pronunciation-to-word',
  TranslateEnglishSentence = 'translate-english-sentence',
  TranslateUkrainianSentence = 'translate-ukrainian-sentence',
  FillTheGap = 'fill-the-gap',
  ContinueDialog = 'continue-dialog',
  SynonymAntonym = 'synonym-antonym',
  FixSentence = 'fix-sentence',
}

export type ToWordData = {
  id: number;
  word: string;
};

export type TextToWordData = ToWordData & {
  text: string;
};

export type ToOptionsData = {
  id: number;
  options: {
    value: string;
    isCorrect: boolean;
  }[];
};

export type WordToOptionsData = ToOptionsData & typeof db.Word.$inferSelect;

export type SentenceData = ToOptionsData & {
  sentence: string;
};

export type ShowcaseTask = {
  id: string;
  type: TaskType.Showcase;
  data: typeof db.Word.$inferSelect;
};

export type WordToDefinitionTask = {
  id: string;
  type: TaskType.WordToDefinition;
  data: WordToOptionsData;
};

export type DefinitionToWordTask = {
  id: string;
  type: TaskType.DefinitionToWord;
  data: TextToWordData;
};

export type WordToTranslationTask = {
  id: string;
  type: TaskType.WordToTranslation;
  data: WordToOptionsData;
};

export type TranslationToWordTask = {
  id: string;
  type: TaskType.TranslationToWord;
  data: TextToWordData;
};

export type PronunciationToWordTask = {
  id: string;
  type: TaskType.PronunciationToWord;
  data: ToWordData & {
    pronunciation: string;
  };
};

export type TranslateEnglishSentenceTask = {
  id: string;
  type: TaskType.TranslateEnglishSentence;
  data: SentenceData;
};

export type TranslateUkrainianSentenceTask = {
  id: string;
  type: TaskType.TranslateUkrainianSentence;
  data: SentenceData;
};

export type FillTheGapTask = {
  id: string;
  type: TaskType.FillTheGap;
  data: TextToWordData;
};

export type ContinueDialogTask = {
  id: string;
  type: TaskType.ContinueDialog;
  data: SentenceData;
};

export type SynonymAntonymData = ToWordData & {
  synonym: string;
  antonym: string;
};

export type SynonymAntonymTask = {
  id: string;
  type: TaskType.SynonymAntonym;
  data: SynonymAntonymData;
};

export type FixSentenceTask = {
  id: string;
  type: TaskType.FixSentence;
  data: SentenceData;
};

export type LearningTask =
  | ShowcaseTask
  | WordToDefinitionTask
  | DefinitionToWordTask
  | WordToTranslationTask
  | TranslationToWordTask
  | PronunciationToWordTask
  | TranslateEnglishSentenceTask
  | TranslateUkrainianSentenceTask
  | FillTheGapTask
  | ContinueDialogTask
  | SynonymAntonymTask
  | FixSentenceTask;
