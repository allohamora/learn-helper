import { count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { vocabularyItem, vocabularyList, vocabularyListItem } from '@/server/db/db.schema';
import { db } from '@/server/db/db.service';
import { groupRowsByLevel, readSourceData, vocabularySeed } from '@/server/vocabulary/vocabulary.seed';
import type { PartOfSpeech } from '@/const/vocabulary';

const SEED_TIMEOUT = 30_000;

const getItemKey = (row: { value: string; partOfSpeech?: PartOfSpeech }) => `${row.value}::${row.partOfSpeech ?? ''}`;

const countListItems = async (vocabularyListId: string) => {
  const [row] = await db
    .select({ value: count() })
    .from(vocabularyListItem)
    .where(eq(vocabularyListItem.vocabularyListId, vocabularyListId));

  return row?.value ?? 0;
};

describe('vocabulary.seed', () => {
  describe('readSourceData', () => {
    it('reads and parses a source JSON file', async () => {
      const rows = await readSourceData('oxford-phrase-list.json');

      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]).toMatchObject({
        value: expect.any(String),
        definition: expect.any(String),
        uaTranslation: expect.any(String),
        level: expect.any(String),
        spelling: expect.any(String),
      });
    });
  });

  describe('vocabularySeed', () => {
    it(
      'inserts vocabulary items and creates level-based lists',
      async () => {
        const sources = [
          { listPrefix: 'Oxford 5000', rows: await readSourceData('oxford-5000-words.json') },
          { listPrefix: 'Oxford Phrase List', rows: await readSourceData('oxford-phrase-list.json') },
        ];
        const allRows = sources.flatMap(({ rows }) => rows);
        const expectedItemCount = new Set(allRows.map(getItemKey)).size;
        const expectedListCount = sources.reduce(
          (sum, { rows }) => sum + new Set(rows.map((row) => row.level)).size,
          0,
        );

        await vocabularySeed();

        expect(await countItems(vocabularyItem)).toEqual(expectedItemCount);
        expect(await countItems(vocabularyList)).toEqual(expectedListCount);
        // each vocabulary item is linked to exactly the one list it was first created under (see vocabulary.seed.ts)
        expect(await countItems(vocabularyListItem)).toEqual(expectedItemCount);

        // an item is only ever linked to the first level (in seeding order) where its value+partOfSpeech key
        // appears; a couple of items share a key across levels (e.g. "lie"/verb in a1 and b1) and only get
        // linked once, so this tracks which keys have already been claimed by an earlier level
        const claimedKeys = new Set<string>();
        for (const { listPrefix, rows } of sources) {
          for (const [level, levelRows] of groupRowsByLevel(rows)) {
            const title = `${listPrefix} ${level.toUpperCase()}`;
            const list = await db.query.vocabularyList.findFirst({ where: eq(vocabularyList.title, title) });
            if (!list) throw new Error(`expected "${title}" list to exist`);

            const newKeys = new Set(levelRows.map(getItemKey).filter((key) => !claimedKeys.has(key)));
            for (const key of newKeys) claimedKeys.add(key);

            expect(await countListItems(list.id)).toEqual(newKeys.size);
          }
        }
      },
      SEED_TIMEOUT,
    );

    it(
      'does not create duplicates on re-run',
      async () => {
        await vocabularySeed();

        const itemCountBefore = await countItems(vocabularyItem);
        const listCountBefore = await countItems(vocabularyList);
        const linkCountBefore = await countItems(vocabularyListItem);

        await vocabularySeed();

        const itemCountAfter = await countItems(vocabularyItem);
        const listCountAfter = await countItems(vocabularyList);
        const linkCountAfter = await countItems(vocabularyListItem);

        expect(itemCountAfter).toBe(itemCountBefore);
        expect(listCountAfter).toBe(listCountBefore);
        expect(linkCountAfter).toBe(linkCountBefore);
      },
      SEED_TIMEOUT,
    );
  });
});
