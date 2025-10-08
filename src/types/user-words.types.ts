import type { ActionReturnType, Actions } from 'astro:actions';
import type { Word } from 'astro:db';
import type { UnionToTuple } from 'type-fest';

export const Level = {
  A1: 'a1',
  A2: 'a2',
  B1: 'b1',
  B2: 'b2',
  C1: 'c1',
} as const;

export const List = {
  Oxford5000Words: 'oxford-5000-words',
  OxfordPhraseList: 'oxford-phrase-list',
} as const;

export const Status = {
  Waiting: 'waiting', // word is waiting to be assigned to learning or known
  Learning: 'learning', // first learning phase
  Struggling: 'struggling', // after first learning, user had problems with it
  Reviewing: 'reviewing', // after struggling or learning, user is reviewing it
  Learned: 'learned', // user successfully learned the word
  Known: 'known', // user already knew the word
} as const;

export type LevelValue = (typeof Level)[keyof typeof Level];
export type ListValue = (typeof List)[keyof typeof List];
export type StatusValue = (typeof Status)[keyof typeof Status];

export const levels = Object.values(Level) as UnionToTuple<LevelValue>;
export const lists = Object.values(List) as UnionToTuple<ListValue>;
export const statuses = Object.values(Status) as UnionToTuple<StatusValue>;

export type Word = NonNullable<ActionReturnType<Actions['getUserWords']>['data']>['data'][number];
