import { parse } from 'node-html-parser';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const OUTPUT_PATH = join(import.meta.dirname, 'output', 'oxford-5000-words.json');
const BASE_URL = 'https://www.oxfordlearnersdictionaries.com';

const getHtml = async () => {
  const res = await fetch(`${BASE_URL}/wordlists/oxford3000-5000`);

  return res.text();
};

const toLink = (relativeLink?: string) => {
  return relativeLink ? `${BASE_URL}${relativeLink}` : null;
};

const schema = z.object({
  word: z.string(),
  level: z.string(),
  partOfSpeech: z.string(),
  link: z.url(),
  usAudioLink: z.url(),
});

const parseHtml = (html: string) => {
  const root = parse(html);
  const list = root.querySelector('.top-g');

  if (!list) {
    throw new Error('list is not found');
  }

  // some items are hidden
  return list.children
    .filter((item) => !!item.getAttribute('data-ox5000'))
    .map((item) => {
      const word = item.getAttribute('data-hw');
      const level = item.getAttribute('data-ox5000');
      const partOfSpeech = item.querySelector('.pos')?.textContent;

      const link = toLink(item.querySelector('a:first-child')?.getAttribute('href'));
      const usAudioLink = toLink(item.querySelector('.pron-us')?.getAttribute('data-src-mp3'));

      try {
        return schema.parse({
          word,
          level,
          partOfSpeech,
          link,
          usAudioLink,
        });
      } catch (error) {
        console.error('parsing list item failed', { html: item.outerHTML, error });

        throw error;
      }
    });
};

export const parseWords = async () => {
  console.log('parsing words has been started');

  const html = await getHtml();
  const words = parseHtml(html);
  const sorted = words.toSorted((a, b) => a.level.localeCompare(b.level));

  await writeFile(OUTPUT_PATH, JSON.stringify(sorted, null, 2));

  console.log(`parsing words has been finished`, { total: words.length, output: OUTPUT_PATH });
};

void parseWords().catch((error) => {
  console.log('parsing words has been failed', { error });
});
