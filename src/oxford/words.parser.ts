import { parse } from 'node-html-parser';
import { z } from 'zod';
import { getHtml, getOutputPath, sortByLevel, toLink, writeOutput } from './utils';

const OUTPUT_PATH = getOutputPath('oxford-5000-words.json');

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

  const html = await getHtml('/wordlists/oxford3000-5000');
  const words = parseHtml(html);
  const sorted = sortByLevel(words);

  await writeOutput(OUTPUT_PATH, sorted);

  console.log(`parsing words has been finished`, { total: words.length, path: OUTPUT_PATH });
};

void parseWords().catch((error) => {
  console.log('parsing words has been failed', { error });
});
