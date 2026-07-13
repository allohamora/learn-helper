export enum EventType {
  UserVocabularyItemDiscovered = 'user-vocabulary-item-discovered',
  UserVocabularyItemTaskFailed = 'user-vocabulary-item-task-failed',
  UserVocabularyItemTaskShowcaseViewed = 'user-vocabulary-item-task-showcase-viewed',
  UserVocabularyItemTaskPassed = 'user-vocabulary-item-task-passed',
  UserVocabularyItemTaskRetryPassed = 'user-vocabulary-item-task-retry-passed',
  UserVocabularyItemTaskHintUsed = 'user-vocabulary-item-task-hint-used',
  UserVocabularyItemTaskGenerated = 'user-vocabulary-item-task-generated',
  UserVocabularyItemMovedToNextStep = 'user-vocabulary-item-moved-to-next-step',
  VocabularyItemUpdated = 'vocabulary-item-updated',
}

export enum UserVocabularyItemTaskType {
  Showcase = 'showcase',
  VocabularyItemToDefinition = 'vocabulary-item-to-definition',
  DefinitionToVocabularyItem = 'definition-to-vocabulary-item',
  VocabularyItemToTranslation = 'vocabulary-item-to-translation',
  TranslationToVocabularyItem = 'translation-to-vocabulary-item',
  PronunciationToVocabularyItem = 'pronunciation-to-vocabulary-item',
  TranslateEnglishSentence = 'translate-english-sentence',
  TranslateUkrainianSentence = 'translate-ukrainian-sentence',
}
