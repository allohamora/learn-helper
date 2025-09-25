import type { ActionReturnType, Actions } from 'astro:actions';
import type { UserWord, Word } from 'astro:db';

export type Level = (typeof Word.$inferInsert)['level'];
export type List = (typeof Word.$inferInsert)['list'];
export type Status = (typeof UserWord.$inferInsert)['status'];

export type Word = NonNullable<ActionReturnType<Actions['getUserWords']>['data']>['data'][number];
