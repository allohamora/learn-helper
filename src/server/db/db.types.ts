import type { db } from './db.service';

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;
