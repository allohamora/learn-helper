import { describe, expect, it } from 'vitest';
import {
  generateTranslationData,
  type TranslatedSelectionDto,
} from '@/server/reading/reading-translation-generation.service';

describe.concurrent('reading-translation-generation.service', () => {
  const assertShape = (output: TranslatedSelectionDto) => {
    expect(typeof output.uaTranslation).toBe('string');
    expect(output.uaTranslation.length).toBeGreaterThan(0);
    expect(output.uaTranslation).not.toMatch(/;/u);
    expect(output.uaTranslation.split('/').length).toBeLessThanOrEqual(2);
    expect(output.uaTranslation).not.toMatch(/^["'«»„“].*["'«»„“]$/u);

    expect(typeof output.isLearnable).toBe('boolean');
  };

  describe('generateTranslationData', () => {
    it('translates a single unambiguous word and marks it learnable', async () => {
      const { output } = await generateTranslationData({ text: 'elephant' });
      console.log('unambiguous-word', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.isLearnable).toBe(true);

      await expect(output).toSatisfyStatements([
        'uaTranslation is the natural Ukrainian word for the animal ("слон", case-insensitive).',
      ]);
    });

    it('falls back to the most common sense when there is no surrounding context', async () => {
      const { output } = await generateTranslationData({ text: 'bank' });
      console.log('ambiguous-word-no-context', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.isLearnable).toBe(true);

      await expect(output).toSatisfyStatements([
        'uaTranslation is the Ukrainian word for the financial institution sense ("банк", case-insensitive) - the most common sense for this word on its own.',
      ]);
    });

    it('translates an idiom idiomatically and marks it learnable', async () => {
      const { output } = await generateTranslationData({ text: "it's raining cats and dogs" });
      console.log('idiom', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.isLearnable).toBe(true);

      await expect(output).toSatisfyStatements([
        'uaTranslation is a natural Ukrainian idiom or phrase meaning heavy rain, not a literal word-for-word translation of "cats and dogs".',
      ]);
    });

    it('translates a short fixed phrase and marks it learnable', async () => {
      const { output } = await generateTranslationData({ text: 'next to' });
      console.log('fixed-phrase', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.isLearnable).toBe(true);

      await expect(output).toSatisfyStatements([
        'uaTranslation means positioned beside or adjacent to something (e.g. "поруч з" or "біля", case-insensitive, or an equally natural equivalent).',
      ]);
    });

    it('translates a full sentence accurately and marks it not learnable', async () => {
      const text = 'The manager explained that the increase in cost was due to a shortage of raw materials.';
      const { output } = await generateTranslationData({ text });
      console.log('full-sentence', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.isLearnable).toBe(false);

      await expect(output).toSatisfyStatements([
        'uaTranslation is a complete, accurate Ukrainian translation of the whole sentence (that the manager explained the cost increase was due to a shortage of raw materials) - not a partial or truncated translation of only part of it.',
      ]);
    });

    it('marks a dependent clause fragment as not learnable', async () => {
      const { output } = await generateTranslationData({
        text: 'even though it was raining heavily all morning',
        before: 'We still went for a walk',
        after: 'and got completely soaked.',
      });
      console.log('clause-fragment', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.isLearnable).toBe(false);
    });

    it('keeps a number as digits instead of spelling it out', async () => {
      const { output } = await generateTranslationData({ text: '42' });
      console.log('number', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.uaTranslation).toBe('42');
    });

    it("mirrors the selected text's lowercase casing instead of capitalizing it", async () => {
      const { output } = await generateTranslationData({ text: 'test' });
      console.log('lowercase-casing', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.uaTranslation).toBe('тест');
    });

    it('translates a long selection that starts and ends mid-sentence, spanning a sentence boundary, and marks it not learnable', async () => {
      // Mirrors a real reading-app selection: dragged across a page, so it starts partway through
      // one sentence, runs past its end, and stops partway into the next - never a clean sentence.
      const { output } = await generateTranslationData({
        text: 'actions build strong routines, and daily repetition strengthens every new skill you practice. These small actions compound gradually into major results',
        before: 'Good habits are the foundation of lasting change. Small consistent',
        after: 'over time, reshaping how you work without you even noticing the shift.',
      });
      console.log('mid-sentence-long-selection', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.isLearnable).toBe(false);

      await expect(output).toSatisfyStatements([
        'uaTranslation translates the selected text in full, from its start (that consistent actions build strong routines) through its end (which is exactly "...compound gradually into major results", with nothing selected past that) - it must not stop early and drop that trailing part off the end, but it also must not continue past that point into the following text about reshaping how you work over time, since that was not part of the selection.',
      ]);
    });

    it('uses surrounding context to pick the right sense of a word, without translating the context itself', async () => {
      const { output } = await generateTranslationData({
        text: 'bark',
        before: 'The dog started to',
        after: 'loudly at the mail carrier.',
      });
      console.log('context-disambiguation', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.isLearnable).toBe(true);

      await expect(output).toSatisfyStatements([
        'uaTranslation is the Ukrainian word/phrase for the sound a dog makes ("гавкати", case-insensitive, or an equally natural equivalent), not a translation of the surrounding sentence about the dog or the mail carrier, and not the tree-bark sense.',
      ]);
    });
  });
});
