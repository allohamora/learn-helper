import { levels, lists, statuses } from '@/types/user-words.types';
import { column, defineDb, defineTable } from 'astro:db';

// we need this for astro:db type issues with readonly arrays
type Writable<T> = {
  -readonly [K in keyof T]: T[K];
};

const Word = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    value: column.text(),
    definition: column.text(),
    partOfSpeech: column.text({ optional: true }),
    level: column.text({ enum: levels as Writable<typeof levels> }),
    spelling: column.text({ optional: true }),
    pronunciation: column.text(),
    link: column.text(),
    list: column.text({ enum: lists as Writable<typeof lists> }),
  },
});

const UserWord = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    userId: column.text(),
    wordId: column.number({ references: () => Word.columns.id }),
    status: column.text({ enum: statuses as Writable<typeof statuses>, default: 'waiting' }),
  },
});

// https://astro.build/db/config
export default defineDb({
  tables: { Word, UserWord },
});
