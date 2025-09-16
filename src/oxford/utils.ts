import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = 'https://www.oxfordlearnersdictionaries.com';

export const getHtml = async (path: string) => {
  const res = await fetch(`${BASE_URL}${path}`);

  return res.text();
};

export const toLink = (relativeLink?: string) => {
  return relativeLink ? `${BASE_URL}${relativeLink}` : null;
};

export const getOutputPath = (fileName: string) => {
  return join(import.meta.dirname, 'output', fileName);
};

export const sortByLevel = <T extends { level: string }>(items: T[]) => {
  return items.toSorted((a, b) => a.level.localeCompare(b.level));
};

export const writeOutput = async <T>(path: string, data: T[]) => {
  await writeFile(path, JSON.stringify(data, null, 2));
};
