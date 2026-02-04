import { List } from '@/types/user-words.types';
import { Word, asc, db, eq } from 'astro:db';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export default async function dump() {
  for (const listValue of Object.values(List)) {
    const rows = await db.select().from(Word).where(eq(Word.list, listValue)).orderBy(asc(Word.level), asc(Word.value));

    const data = rows.map((row) => ({
      value: row.value,
      definition: row.definition,
      uaTranslation: row.uaTranslation,
      ...(row.partOfSpeech && { partOfSpeech: row.partOfSpeech }),
      level: row.level,
      spelling: row.spelling,
      pronunciation: row.pronunciation,
      link: row.link,
    }));

    const path = join(process.cwd(), 'db', 'data', `${listValue}.json`);
    await writeFile(path, JSON.stringify(data, null, 2) + '\n');
  }
}
