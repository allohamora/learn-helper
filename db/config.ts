import { column, defineDb, defineTable, NOW, sql } from 'astro:db';

// random symbols for id
const ID = sql`lower(hex(randomblob(16)))`;

const Word = defineTable({
  columns: {
    id: column.text({ primaryKey: true, default: ID }),
    value: column.text(),
    definition: column.text(),
    partOfSpeech: column.text({ optional: true }),
    level: column.text(),
    spelling: column.text({ optional: true }),
    pronunciation: column.text(),
    link: column.text(),
    list: column.text(),
    createdAt: column.date({ default: NOW }),
  },
});

// https://astro.build/db/config
export default defineDb({
  tables: { Word },
});
