import { column, defineDb, defineTable } from 'astro:db';

const Word = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    value: column.text(),
    definition: column.text(),
    partOfSpeech: column.text({ optional: true }),
    level: column.text({ enum: ['a1', 'a2', 'b1', 'b2', 'c1'] }),
    spelling: column.text({ optional: true }),
    pronunciation: column.text(),
    link: column.text(),
    list: column.text({ enum: ['oxford-5000-words', 'oxford-phrase-list'] }),
  },
});

const UserWord = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    userId: column.text(),
    wordId: column.number({ references: () => Word.columns.id }),
    status: column.text({ enum: ['waiting', 'learning', 'known', 'learned'], default: 'waiting' }),
  },
});

// https://astro.build/db/config
export default defineDb({
  tables: { Word, UserWord },
});
