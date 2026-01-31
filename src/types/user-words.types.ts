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
