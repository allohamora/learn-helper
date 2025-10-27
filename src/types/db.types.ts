import type { db } from 'astro:db';

type Database = typeof db;
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0] | Database;
