export type Level = 'a1' | 'a2' | 'b1' | 'b2' | 'c1';
export type ListType = 'oxford-5000-words' | 'oxford-phrase-list';
export type Status = 'waiting' | 'learning' | 'known' | 'learned';

export type Word = {
  id: number;
  wordId: number;
  userId: string;
  status: Status;
  level?: Level;
  value?: string;
  list?: ListType;
  link?: string;
  definition?: string;
  partOfSpeech?: string | null;
  spelling?: string | null;
  pronunciation?: string;
};
