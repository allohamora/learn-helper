import '@tanstack/react-start/server-only';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { disconnectFromDb, runMigrations } from '../db/db.service';
import { toChunks } from '../utils/array.utils';
import { createLogger } from '../utils/logger.utils';
import { createMissingVocabularyItems } from './vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from './vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from './vocabulary-list.repository';
import { PartOfSpeech } from '@/const/vocabulary';

const logger = createLogger('vocabulary.seed');

type RawVocabularyItem = {
  value: string;
  definition: string;
  uaTranslation: string;
  partOfSpeech?: PartOfSpeech;
  level: string;
  spelling: string;
  pronunciation?: string;
  link?: string;
};

type Source = { file: string; listPrefix: string };

const SOURCES: Source[] = [
  { file: 'oxford-5000-words.json', listPrefix: 'Oxford 5000' },
  { file: 'oxford-phrase-list.json', listPrefix: 'Oxford Phrase List' },
];

const CHUNK_SIZE = 100;
const DATA_DIR = path.join(process.cwd(), 'data');

export const readSourceData = async (file: string) => {
  const raw = await readFile(path.join(DATA_DIR, file), 'utf-8');
  return JSON.parse(raw) as RawVocabularyItem[];
};

export const groupRowsByLevel = <T extends { level: string }>(rows: T[]) => {
  const rowsByLevel = new Map<string, T[]>();

  for (const row of rows) {
    const group = rowsByLevel.get(row.level) ?? [];
    group.push(row);

    rowsByLevel.set(row.level, group);
  }

  return rowsByLevel;
};

export const vocabularySeed = async () => {
  let total = 0;
  let newItemCount = 0;

  for (const source of SOURCES) {
    const rowsByLevel = groupRowsByLevel(await readSourceData(source.file));

    for (const [level, levelRows] of rowsByLevel) {
      const title = `${source.listPrefix} ${level.toUpperCase()}`;
      const list = await findOrCreateVocabularyListByTitle(title);

      for (const batch of toChunks(levelRows, CHUNK_SIZE)) {
        const newItems = await createMissingVocabularyItems(
          batch.map((row) => ({
            value: row.value,
            definition: row.definition,
            uaTranslation: row.uaTranslation,
            partOfSpeech: row.partOfSpeech,
            spelling: row.spelling,
            pronunciation: row.pronunciation,
            link: row.link,
          })),
        );

        if (newItems.length > 0) {
          // only newly inserted items need a new link; pre-existing items were already linked in a prior run
          await createVocabularyListItemsIfNotExist(
            newItems.map((item) => ({ vocabularyListId: list.id, vocabularyItemId: item.id })),
          );
          newItemCount += newItems.length;
        }

        total += batch.length;
        logger.info({ msg: 'seeding progress', title, current: batch.length, total });
      }
    }
  }

  logger.info({ msg: 'seeding complete', newItemCount, total });
};

if (import.meta.main) {
  try {
    await runMigrations();
    await vocabularySeed();
  } finally {
    await disconnectFromDb();
  }
}
