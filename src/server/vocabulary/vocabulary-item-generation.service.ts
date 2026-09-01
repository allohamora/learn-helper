import '@tanstack/react-start/server-only';
import { generateText, Output } from 'ai';
import { openai } from '../utils/ai.utils';
import { calculateCostInNanoDollars } from '../utils/ai-cost.utils';
import { generatedVocabularyItemDto } from './dtos/generated-vocabulary-item.dto';
import type { GenerateVocabularyItemDto } from './dtos/generate-vocabulary-item.dto';

const model = openai('gpt-5.6-luna');

export const generateVocabularyItemData = async ({ value, context }: GenerateVocabularyItemDto) => {
  const { output, usage } = await generateText({
    model,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'generateVocabularyItemData',
    },
    output: Output.object({
      schema: generatedVocabularyItemDto,
    }),
    prompt: [
      '<role>Expert bilingual (English-Ukrainian) lexicographer building dictionary entries for language learners.</role>',
      '<task>Given a value and optional free-text context typed by the user, produce one dictionary-style vocabulary entry for the value.</task>',
      '<workflow>',
      '1. Correct any spelling/grammar mistakes in the value; use the corrected form everywhere below.',
      "2. Use context, if any, to pick the value's sense/domain/register; fall back to its most common sense if context does not help.",
      '3. Write the definition, translation, spelling, and part of speech for that sense.',
      '</workflow>',
      '<requirements>',
      'General:',
      '- Context is context for the value, provided by the user - it may be a full sentence containing the value, a vague/unhelpful note ("not sure", "no idea what this means"), or contain its own typos; never correct it or copy it into the output.',
      '- Describe only the literal, direct meaning of the value in that sense - no trivia, notable facts, or cultural associations, no matter how famous.',
      'value:',
      '- The corrected value, max 255 characters, cased per standard English capitalization rules regardless of how the input was cased - not capitalized just because it starts a phrase/sentence.',
      '- For a number or ordinal number, use its spelled-out word form (e.g. "forty-two", "third"), not digits.',
      'definition:',
      '- Concise English dictionary-style definition, max 512 characters, meaning only (no examples or translations).',
      '- Written as a lowercase phrase/clause fragment, like a dictionary gloss - no leading capital letter and no trailing period.',
      '- Must precisely match the chosen part of speech and sense, not a different closely related meaning or word.',
      '- For grammatical function words (articles, pronouns, prepositions, conjunctions, auxiliary/modal verbs, determiners), state both the role and its typical usage pattern (what it precedes or combines with).',
      '- For a number or ordinal number, the definition is just the numeral itself (e.g. "8", "80", "5th") - not a prose description.',
      'uaTranslation:',
      '- Natural Ukrainian translation, exactly as a native Ukrainian speaker would actually say it (this includes translating idioms and fixed expressions idiomatically, not word-for-word), max 255 characters.',
      '- A single translation - do not list multiple synonym options. The only exception is genuine grammatical variants (e.g. gender-dependent forms), where up to two forms separated by " / " are allowed; never use semicolons.',
      "- Capitalize per standard Ukrainian orthography (e.g. proper nouns, acronyms) regardless of the value's casing.",
      '- The definite/indefinite articles and the infinitive marker "to" have no lexical translation in Ukrainian - state the grammatical role instead (e.g. "означений артикль", "неозначений артикль", "частка інфінітива").',
      'spelling:',
      '- A single IPA transcription wrapped in slashes, e.g. "/wɜːd/", max 255 characters - one transcription only, not multiple variants (e.g. British/American).',
      'partOfSpeech:',
      '- The narrowest enum value matching the grammatical function in that sense, including fixed multi-word units (phrasal verbs, compound nouns, prepositional/adverbial fixed phrases, etc.) as one unit.',
      '- Null only when the value is a full clause, sentence, greeting, or idiom that does not reduce to a single word class.',
      '</requirements>',
      `<value>${JSON.stringify(value)}</value>`,
      `<context>${JSON.stringify(context ?? null)}</context>`,
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
