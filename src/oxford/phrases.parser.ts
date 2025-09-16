import { parse } from 'node-html-parser';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const OUTPUT_PATH = join(import.meta.dirname, 'output', 'oxford-phrase-list.json');
const BASE_URL = 'https://www.oxfordlearnersdictionaries.com';

const getHtml = async () => {
  const res = await fetch(`${BASE_URL}/wordlists/oxford-phrase-list`);

  return res.text();
};

const toLink = (relativeLink?: string) => {
  return relativeLink ? `${BASE_URL}${relativeLink}` : null;
};

const schema = z.object({
  phrase: z.string(),
  level: z.string(),
  link: z.url(),
  usAudioLink: z.url(),
});

const parseHtml = (html: string) => {
  const root = parse(html);
  const list = root.querySelector('.top-g');

  if (!list) {
    throw new Error('list is not found');
  }

  return list.children.map((item) => {
    const phrase = item.getAttribute('data-hw');
    const level = item.getAttribute('data-oxford_phrase_list');

    const link = toLink(item.querySelector('a:first-child')?.getAttribute('href'));
    const usAudioLink = toLink(item.querySelector('.pron-us')?.getAttribute('data-src-mp3'));

    try {
      return schema.parse({
        phrase,
        level,
        link,
        usAudioLink,
      });
    } catch (error) {
      console.error('parsing list item failed', { html: item.outerHTML, error });

      throw error;
    }
  });
};

export const parsePhrases = async () => {
  console.log('parsing phrases has been started');

  const html = await getHtml();
  const phrases = parseHtml(html);
  const sorted = phrases.toSorted((a, b) => a.level.localeCompare(b.level));

  await writeFile(OUTPUT_PATH, JSON.stringify(sorted, null, 2));

  console.log(`parsing phrases has been finished`, { total: phrases.length, output: OUTPUT_PATH });
};

void parsePhrases().catch((error) => {
  console.log('parsing phrases has been failed', { error });
});
