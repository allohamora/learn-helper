import { VocabularyListType } from '@/const/vocabulary';

export const getVocabularyListTitle = ({ type, title }: { type: VocabularyListType; title: string | null }) =>
  type === VocabularyListType.Personal ? 'Personal' : (title ?? 'Untitled');

export const formatPartOfSpeech = (partOfSpeech: string) => partOfSpeech.replace(/-/g, ' ');
