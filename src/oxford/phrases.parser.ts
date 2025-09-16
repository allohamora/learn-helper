import { parse } from 'node-html-parser';
import { z } from 'zod';
import { getHtml, getOutputPath, sortByLevel, toLink, writeOutput } from './utils';

const OUTPUT_PATH = getOutputPath('oxford-phrase-list.json');

const schema = z.object({
  phrase: z.string().min(1),
  level: z.string().min(1),
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
    const phrase = item.getAttribute('data-hw')?.trim();
    const level = item.getAttribute('data-oxford_phrase_list')?.trim();

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
      console.error('parsing list item has failed', { html: item.outerHTML, error });

      throw error;
    }
  });
};

const parsePhrases = async () => {
  console.log('parsing phrases has started');

  const html = await getHtml('/wordlists/oxford-phrase-list');
  const phrases = parseHtml(html);
  const sorted = sortByLevel(phrases);

  await writeOutput(OUTPUT_PATH, sorted);

  console.log(`parsing phrases has finished`, { total: phrases.length, path: OUTPUT_PATH });
};

void parsePhrases().catch((error) => {
  console.log('parsing phrases has failed', { error });
});
