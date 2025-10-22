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

export type UserWord = { word: typeof db.Word.$inferSelect } & typeof db.UserWord.$inferSelect;

export enum TaskType {
  Showcase = 'showcase',
  WordToDefinition = 'word-to-definition',
  DefinitionToWord = 'definition-to-word',
  WordToTranslation = 'word-to-translation',
  TranslationToWord = 'translation-to-word',
  WriteByPronunciation = 'write-by-pronunciation',
  TranslateEnglishSentence = 'translate-english-sentence',
  TranslateUkrainianSentence = 'translate-ukrainian-sentence',
  FillTheGap = 'fill-the-gap',
}

export type TextToWordData = {
  id: number;
  text: string;
  word: string;
};

export type WordToOptionsData = typeof db.Word.$inferSelect & {
  options: {
    id: number;
    value: string;
    isCorrect: boolean;
  }[];
};

export type TranslateSentenceData = {
  id: number;
  sentence: string;
  options: {
    value: string;
    isCorrect: boolean;
  }[];
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

export type WriteByPronunciationTask = {
  id: string;
  type: TaskType.WriteByPronunciation;
  data: {
    id: number;
    pronunciation: string;
    answer: string;
  };
};

export type TranslateEnglishSentenceTask = {
  id: string;
  type: TaskType.TranslateEnglishSentence;
  data: {
    id: number;
    sentence: string;
    options: {
      value: string;
      isCorrect: boolean;
    }[];
  };
};

export type TranslateUkrainianSentenceTask = {
  id: string;
  type: TaskType.TranslateUkrainianSentence;
  data: {
    id: number;
    sentence: string;
    options: {
      value: string;
      isCorrect: boolean;
    }[];
  };
};

export type FillTheGapTask = {
  id: string;
  type: TaskType.FillTheGap;
  data: {
    id: number;
    task: string;
    options: {
      id: number;
      value: string;
      partOfSpeech: string | null;
      isCorrect: boolean;
    }[];
  };
};

export type LearningTask =
  | ShowcaseTask
  | WordToDefinitionTask
  | DefinitionToWordTask
  | WordToTranslationTask
  | TranslationToWordTask
  | WriteByPronunciationTask
  | TranslateEnglishSentenceTask
  | TranslateUkrainianSentenceTask
  | FillTheGapTask;
