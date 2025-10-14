import { Level, List, Status } from '@/types/user-words.types';
import { column, defineDb, defineTable, NOW } from 'astro:db';
import type { UnionToTuple } from 'type-fest';

const Word = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    value: column.text(),
    definition: column.text(),
    partOfSpeech: column.text({ optional: true }),
    level: column.text({ enum: Object.values(Level) as UnionToTuple<(typeof Level)[keyof typeof Level]> }),
    spelling: column.text({ optional: true }),
    pronunciation: column.text(),
    link: column.text(),
    list: column.text({ enum: Object.values(List) as UnionToTuple<(typeof List)[keyof typeof List]> }),
  },
});

const UserWord = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    userId: column.text(),
    wordId: column.number({ references: () => Word.columns.id }),
    wordsToUnlock: column.number({ default: 0 }),
    encounterCount: column.number({ default: 0 }),
    status: column.text({
      enum: Object.values(Status) as UnionToTuple<(typeof Status)[keyof typeof Status]>,
      default: Status.Waiting,
    }),
    updatedAt: column.date({ default: NOW }),
  },
});

// https://astro.build/db/config
export default defineDb({
  tables: { Word, UserWord },
});
