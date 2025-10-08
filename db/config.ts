import { levels, lists, Status, statuses } from '@/types/user-words.types';
import { column, defineDb, defineTable } from 'astro:db';

const Word = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    value: column.text(),
    definition: column.text(),
    partOfSpeech: column.text({ optional: true }),
    level: column.text({ enum: levels }),
    spelling: column.text({ optional: true }),
    pronunciation: column.text(),
    link: column.text(),
    list: column.text({ enum: lists }),
  },
});

const UserWord = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    userId: column.text(),
    wordId: column.number({ references: () => Word.columns.id }),
    status: column.text({ enum: statuses, default: Status.Waiting }),
  },
});

// https://astro.build/db/config
export default defineDb({
  tables: { Word, UserWord },
});
