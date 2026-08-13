import { vitest } from 'vitest';

vitest.mock('node:fs/promises', async (importOriginal) => {
  // readFile stays real: vocabulary.seed.spec.ts reads actual fixture files through it
  const { readFile } = await importOriginal<typeof import('node:fs/promises')>();

  return { mkdir: vitest.fn(), writeFile: vitest.fn(), readFile };
});
