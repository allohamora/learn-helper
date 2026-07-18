import '@tanstack/react-start/server-only';
import { generateText, Output, type LanguageModelUsage } from 'ai';
import { createGoogleGenerativeAI, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import { z } from 'zod';
import { GEMINI_API_KEY } from '../config';
import { UserVocabularyItemTaskType } from '@/const/event';
import { Exception } from '../utils/exception.utils';

const google = createGoogleGenerativeAI({
  apiKey: GEMINI_API_KEY,
});

const model = google('gemini-2.5-flash-lite');

const INPUT_NANO_DOLLARS_PER_TOKEN = 100;
const OUTPUT_NANO_DOLLARS_PER_TOKEN = 400;

const calculateCostInNanoDollars = ({ inputTokens = 0, outputTokens = 0 }: LanguageModelUsage) => {
  const inputCostInNanoDollars = inputTokens * INPUT_NANO_DOLLARS_PER_TOKEN;
  const outputCostInNanoDollars = outputTokens * OUTPUT_NANO_DOLLARS_PER_TOKEN;

  return inputCostInNanoDollars + outputCostInNanoDollars;
};

export type VocabularyItemData = {
  id: string;
  value: string;
  partOfSpeech: string | null;
};

type GeneratedTask = { id: string; sentence: string; translation: string };

// the schema only validates each task's shape, not that the batch as a whole maps onto the
// requested items, so a missing item, a duplicate id, or a fabricated id must be caught here
export const tasksMatchRequestedItems = (tasks: GeneratedTask[], items: VocabularyItemData[]) => {
  const expectedIds = new Set(items.map((item) => item.id));
  const taskIds = tasks.map((task) => task.id);

  return (
    taskIds.length === items.length &&
    new Set(taskIds).size === items.length &&
    taskIds.every((id) => expectedIds.has(id))
  );
};

export const toTranslateEnglishSentence = async (items: VocabularyItemData[]) => {
  const { finalStep, output, usage } = await generateText({
    model,
    providerOptions: {
      google: {
        thinkingConfig: {
          includeThoughts: true,
          thinkingBudget: 2048,
        },
      } satisfies GoogleLanguageModelOptions,
    },
    temperature: 0.7,
    output: Output.array({
      element: z.object({
        id: z.uuidv7(),
        sentence: z.string(),
        translation: z.string(),
      }),
    }),
    prompt: [
      '<role>Expert bilingual exercise writer (English-Ukrainian).</role>',
      `<task>Create exactly ${items.length} English->Ukrainian word-order tasks, one per input word.</task>`,
      '<workflow>',
      '1. For each word, build the target pattern from its value.',
      '2. Write an English sentence with specific real-world context.',
      '3. Translate it into natural Ukrainian a native speaker would actually say.',
      '4. Output: id = word.id, sentence = English, translation = Ukrainian.',
      '</workflow>',
      '<requirements>',
      'English sentence:',
      '- Complete sentence (subject + verb), sentence case, max 15 words.',
      '- Single sentence. No semicolons, colons, or dashes (–, —, -).',
      '- Must contain ALL non-placeholder tokens from the target in order.',
      '- For phrasal verbs, include every particle (e.g., "take (sb) out" requires "take" AND "out").',
      '- Only verb/auxiliary inflection allowed (e.g., "be going to" -> "is going to").',
      '- Keep all function words unchanged.',
      '- If the target is "a", place it before a consonant-starting word (not "an").',
      '- Use specific context, not vague abstract sentences.',
      'Ukrainian translation:',
      '- Max 15 words, sentence case, single sentence.',
      '- Must sound natural to a native Ukrainian speaker.',
      '- Use idiomatic Ukrainian, not word-for-word translation from English.',
      '- Single spaces, punctuation attached to tokens.',
      '- NEVER use dash characters (–, —, -) in the translation. Rephrase to avoid them.',
      '- One unambiguous word order when shuffled.',
      '- Pronouns/prepositions/conjunctions/particles as separate tokens.',
      '- Correct adjective-noun agreement (gender/number/case).',
      'Placeholders:',
      '- Replace every parenthesized placeholder with a concrete word.',
      '- Never output literal placeholder text in the sentence.',
      '</requirements>',
      `<words>${JSON.stringify(items)}</words>`,
    ].join('\n'),
  });

  if (!tasksMatchRequestedItems(output, items)) {
    throw Exception.internalServer(
      `generated ${UserVocabularyItemTaskType.TranslateEnglishSentence} tasks do not match the requested vocabulary items`,
    );
  }

  const cost = {
    taskType: UserVocabularyItemTaskType.TranslateEnglishSentence,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { reasoning: finalStep.reasoning, tasks: output, cost };
};

export const toTranslateUkrainianSentence = async (items: VocabularyItemData[]) => {
  const { finalStep, output, usage } = await generateText({
    model,
    providerOptions: {
      google: {
        thinkingConfig: {
          includeThoughts: true,
          thinkingBudget: 2048,
        },
      } satisfies GoogleLanguageModelOptions,
    },
    temperature: 0.7,
    output: Output.array({
      element: z.object({
        id: z.uuidv7(),
        sentence: z.string(),
        translation: z.string(),
      }),
    }),
    prompt: [
      '<role>Expert bilingual exercise writer (Ukrainian-English).</role>',
      `<task>Create exactly ${items.length} Ukrainian->English word-order tasks, one per input word.</task>`,
      '<workflow>',
      '1. For each word, build the target pattern from its value.',
      '2. Write an English sentence with specific real-world context.',
      '3. Write a natural Ukrainian sentence a native speaker would actually say.',
      '4. Output: id = word.id, sentence = Ukrainian, translation = English.',
      '</workflow>',
      '<requirements>',
      'Ukrainian sentence:',
      '- Max 15 words, sentence case, grammatical, single sentence.',
      '- No semicolons or colons.',
      '- NEVER use dash characters (–, —, -) in the sentence. Rephrase to avoid them.',
      '- Must sound natural to a native Ukrainian speaker.',
      '- Use idiomatic Ukrainian, not word-for-word translation from English.',
      'English translation:',
      '- Complete sentence (subject + verb), sentence case, max 15 words.',
      '- Single sentence. No semicolons, colons, or dashes (–, —, -).',
      '- Must contain ALL non-placeholder tokens from the target in order.',
      '- For phrasal verbs, include every particle (e.g., "take (sb) out" requires "take" AND "out").',
      '- Only verb/auxiliary inflection allowed (e.g., "be going to" -> "is going to").',
      '- Keep all function words unchanged.',
      '- If the target is "a", place it before a consonant-starting word (not "an").',
      '- Use specific context, not vague abstract sentences.',
      '- Include required articles/prepositions/auxiliaries as separate tokens.',
      '- Single spaces, punctuation attached to tokens.',
      '- One unambiguous word order when shuffled.',
      'Placeholders:',
      '- Replace every parenthesized placeholder with a concrete word.',
      '- Never output literal placeholder text in the translation.',
      '</requirements>',
      `<words>${JSON.stringify(items)}</words>`,
    ].join('\n'),
  });

  if (!tasksMatchRequestedItems(output, items)) {
    throw Exception.internalServer(
      `generated ${UserVocabularyItemTaskType.TranslateUkrainianSentence} tasks do not match the requested vocabulary items`,
    );
  }

  const cost = {
    taskType: UserVocabularyItemTaskType.TranslateUkrainianSentence,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { reasoning: finalStep.reasoning, tasks: output, cost };
};
