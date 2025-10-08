import type { ActionReturnType, Actions } from 'astro:actions';
import type { Word } from 'astro:db';

export const levels = ['a1', 'a2', 'b1', 'b2', 'c1'] as const;
export const lists = ['oxford-5000-words', 'oxford-phrase-list'] as const;

export const statuses = [
  'waiting', // word is waiting to be assigned to learning or known
  'learning', // first learning phase
  'struggling', // after first learning, user had problems with it
  'reviewing', // after struggling or learning, user is reviewing it
  'learned', // user successfully learned the word
  'known', // user already knew the word
] as const;

export type Level = (typeof levels)[number];
export type List = (typeof lists)[number];
export type Status = (typeof statuses)[number];

export type Word = NonNullable<ActionReturnType<Actions['getUserWords']>['data']>['data'][number];
