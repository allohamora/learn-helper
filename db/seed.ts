import { List, Level } from '@/types/user-words.types';
import { db, Word } from 'astro:db';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const getData = async <T>(name: string) => {
  const path = join(process.cwd(), 'db', 'data', `${name}.json`);
  const data = await readFile(path, 'utf-8');

  return JSON.parse(data) as T;
};

type Word = {
  value: string; // "visit",
  definition: string; // "an occasion or a period of time when somebody goes to see a place or person and spends time there",
  partOfSpeech?: string; // "noun",
  level: Level; // "a1",
  spelling?: string; // "/ˈvɪzɪt/",
  pronunciation: string; // "https://www.oxfordlearnersdictionaries.com/media/english/us_pron/v/vis/visit/visit__us_1.mp3",
  link: string; // "https://www.oxfordlearnersdictionaries.com/definition/english/visit_2"
};

// https://astro.build/db/seed
export default async function seed() {
  const words = await getData<Word[]>(List.Oxford5000Words);
  const phrases = await getData<Word[]>(List.OxfordPhraseList);

  for (const word of words) {
    await db.insert(Word).values({
      ...word,
      list: List.Oxford5000Words,
    });
  }

  for (const phrase of phrases) {
    await db.insert(Word).values({
      ...phrase,
      list: List.OxfordPhraseList,
    });
  }
}
