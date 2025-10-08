import type { ActionReturnType, Actions } from 'astro:actions';
import type { Word } from 'astro:db';

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
  Struggling = 'struggling', // after first learning, user had problems with it
  Reviewing = 'reviewing', // after struggling or learning, user is reviewing it
  Learned = 'learned', // user successfully learned the word
  Known = 'known', // user already knew the word
}

export type Word = NonNullable<ActionReturnType<Actions['getUserWords']>['data']>['data'][number];
