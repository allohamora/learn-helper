export enum PartOfSpeech {
  Adjective = 'adjective',
  Adverb = 'adverb',
  AuxiliaryVerb = 'auxiliary-verb',
  Conjunction = 'conjunction',
  DefiniteArticle = 'definite-article',
  Determiner = 'determiner',
  Exclamation = 'exclamation',
  IndefiniteArticle = 'indefinite-article',
  InfinitiveMarker = 'infinitive-marker',
  LinkingVerb = 'linking-verb',
  ModalVerb = 'modal-verb',
  Noun = 'noun',
  Number = 'number',
  OrdinalNumber = 'ordinal-number',
  Preposition = 'preposition',
  Pronoun = 'pronoun',
  Verb = 'verb',
}

export enum LearningStatus {
  Waiting = 'waiting',
  Learning = 'learning',
  Learned = 'learned',
  Known = 'known',
}

export enum VocabularyListType {
  Public = 'public',
  Personal = 'personal',
}

export const LEARNING_STATUS_ORDER: LearningStatus[] = [
  LearningStatus.Waiting,
  LearningStatus.Learning,
  LearningStatus.Learned,
  LearningStatus.Known,
];

export const LEARNING_STATUS_LABEL: Record<LearningStatus, string> = {
  [LearningStatus.Waiting]: 'Waiting',
  [LearningStatus.Learning]: 'Learning',
  [LearningStatus.Learned]: 'Learned',
  [LearningStatus.Known]: 'Known',
};

export const LEARNING_STATUS_BG_CLASS: Record<LearningStatus, string> = {
  [LearningStatus.Waiting]: 'bg-status-waiting',
  [LearningStatus.Learning]: 'bg-status-learning',
  [LearningStatus.Learned]: 'bg-status-learned',
  [LearningStatus.Known]: 'bg-status-known',
};
