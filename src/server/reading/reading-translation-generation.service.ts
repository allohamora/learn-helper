import '@tanstack/react-start/server-only';
import { generateText, Output } from 'ai';
import { z } from '@hono/zod-openapi';
import { model, calculateCostInNanoDollars } from '../utils/ai.utils';
import type { TranslateSelectionDto } from './dtos/translate-selection.dto';

const translatedSelectionDto = z.object({
  // No max length tied to vocabularyItem.uaTranslation's column limit (255) - that limit only
  // matters when actually persisting a learning item. This is a display-only translation of up
  // to a 400-char selection (MAX_SELECTION_LENGTH), whose natural translation can legitimately
  // run longer than 255 chars even when the selection itself isn't learnable.
  uaTranslation: z.string().trim().min(1),
  // true only for a single word / short fixed phrase / idiom, not a full clause or sentence
  isLearnable: z.boolean(),
});

export type TranslatedSelectionDto = z.infer<typeof translatedSelectionDto>;

export const generateTranslationData = async ({ text, before, after }: TranslateSelectionDto) => {
  const { output, usage } = await generateText({
    model,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'generateTranslationData',
    },
    output: Output.object({
      schema: translatedSelectionDto,
    }),
    prompt: [
      '<role>Expert bilingual (English-Ukrainian) translator helping a language learner reading English text.</role>',
      '<task>Given a piece of text the user selected, and the text immediately before/after it (if any), translate the selected text and judge whether it is learnable.</task>',
      '<requirements>',
      'uaTranslation:',
      '- Natural Ukrainian translation of the selected text, exactly as a native Ukrainian speaker would actually say it (this includes translating idioms and fixed expressions idiomatically, not word-for-word).',
      '- A single translation - do not list multiple synonym options. The only exception is genuine grammatical variants (e.g. gender-dependent forms), where up to two forms separated by " / " are allowed; never use semicolons.',
      "- This is a live translation of exactly what the user selected, not a dictionary headword - preserve its surface form (casing, digits vs spelled-out numbers) rather than normalizing it, except where Ukrainian orthography inherently requires a specific form regardless of the source's casing.",
      '- It is inserted verbatim into a UI label the user reads directly, so it must be the translation itself and nothing else, never wrapped in a quotation mark of any kind (\', ", «», “”, „") even for a single word or number - e.g. for the unrelated placeholder word "flonket" with no context, output флонкет, not "флонкет" or «флонкет».',
      '- Use before/after only to resolve an ambiguous word or sense in the selected text - never translate before/after themselves, only the selected text.',
      'isLearnable:',
      '- true only for a single word or a short fixed phrase/idiom/collocation memorized as one unit - the kind of entry a phrasebook or dictionary would list on its own.',
      '- false for anything freshly composed for its specific context rather than a memorized fixed unit, even if short - including an ordinary clause or sentence with its own subject and verb. When genuinely unsure, prefer false.',
      '</requirements>',
      `<before>${JSON.stringify(before ?? null)}</before>`,
      `<text>${JSON.stringify(text)}</text>`,
      `<after>${JSON.stringify(after ?? null)}</after>`,
    ].join('\n'),
  });

  return {
    output,
    cost: {
      costInNanoDollars: calculateCostInNanoDollars(usage),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    },
  };
};
