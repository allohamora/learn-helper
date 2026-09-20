import '@tanstack/react-start/server-only';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { gpt56Luna } from '../utils/ai.utils';
import { UserVocabularyItemTaskType } from '@/const/event';
import { Exception } from '../utils/exception.utils';

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
  const { output, usage } = await generateText({
    model: gpt56Luna.model,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'toTranslateEnglishSentence',
    },
    output: Output.array({
      element: z.object({
        id: z.uuidv7(),
        sentence: z.string(),
        translation: z.string(),
      }),
    }),
    prompt: [
      '<role>Expert bilingual exercise writer (English-Ukrainian).</role>',
      `<task>Create exactly ${items.length} English-to-Ukrainian word-order tasks, one per input item.</task>`,
      '<workflow>',
      '1. For each item, build the target pattern from its value.',
      '2. Write an English sentence with specific real-world context.',
      '3. Translate it into natural Ukrainian a native speaker would actually say.',
      "4. Before finalizing, re-read the Ukrainian translation word by word and fix two things if present: (a) any word or fragment left in English instead of translated, (b) any adjective that doesn't agree with its noun in gender, case, and number.",
      '5. Output: id = item.id, sentence = English, translation = Ukrainian.',
      '</workflow>',
      '<requirements>',
      'English sentence:',
      '- A single, complete, natural sentence in sentence case, max 15 words, with no semicolons, colons, or dashes (–, —, -).',
      '- Contains every word of the target pattern, in order and otherwise unchanged, with only the minimal grammatical adjustment English requires (e.g. verb/auxiliary inflection, "a" vs "an"). If the target\'s own verb is generic (e.g. a placeholder-taking phrase like "have a look at (sth)"), never collapse it into a single more specific verb that already implies the object (e.g. "inspect (sth)") - keep the target\'s own generic verb exactly as given, and let the concrete word filling the placeholder carry the specific meaning instead (e.g. "have a look at the report", not "review the report").',
      '- Set in a specific, real situation, not a vague or abstract statement.',
      'Ukrainian translation:',
      '- A single, natural sentence in sentence case, max 15 words, that a native speaker would actually say - idiomatic, not a word-for-word rendering of the English.',
      '- Written entirely in Ukrainian, every single word - never a stray English word or fragment left untranslated.',
      '- No semicolons, colons, or dashes (–, —, -), including any introduced while rephrasing.',
      '- Single spaces, punctuation attached to the preceding token, and only one sensible word order once the words are shuffled.',
      '- Pronouns, prepositions, conjunctions, and particles as separate tokens, with correct adjective-noun agreement (gender, case, and number).',
      'Placeholders:',
      '- Replace every parenthesized placeholder in the target with a concrete word; never output the placeholder text itself.',
      '</requirements>',
      `<items>${JSON.stringify(items)}</items>`,
    ].join('\n'),
  });

  if (!tasksMatchRequestedItems(output, items)) {
    throw Exception.internalServer(
      `Generated ${UserVocabularyItemTaskType.TranslateEnglishSentence} tasks do not match the requested vocabulary items`,
    );
  }

  const cost = {
    taskType: UserVocabularyItemTaskType.TranslateEnglishSentence,
    costInNanoDollars: gpt56Luna.calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { tasks: output, cost };
};

export const toTranslateUkrainianSentence = async (items: VocabularyItemData[]) => {
  const { output, usage } = await generateText({
    model: gpt56Luna.model,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'toTranslateUkrainianSentence',
    },
    output: Output.array({
      element: z.object({
        id: z.uuidv7(),
        sentence: z.string(),
        translation: z.string(),
      }),
    }),
    prompt: [
      '<role>Expert bilingual exercise writer (Ukrainian-English).</role>',
      `<task>Create exactly ${items.length} Ukrainian-to-English word-order tasks, one per input item.</task>`,
      '<workflow>',
      '1. For each item, build the target pattern from its value.',
      '2. Write an English sentence with specific real-world context.',
      '3. Write a natural Ukrainian sentence a native speaker would actually say.',
      "4. Before finalizing, re-read the Ukrainian sentence word by word and fix two things if present: (a) any word or fragment left in English instead of translated, (b) any adjective that doesn't agree with its noun in gender, case, and number.",
      '5. Output: id = item.id, sentence = Ukrainian, translation = English.',
      '</workflow>',
      '<requirements>',
      'Ukrainian sentence:',
      '- A single, natural, grammatical sentence in sentence case, max 15 words, that a native speaker would actually say - idiomatic, not a word-for-word rendering of the English.',
      '- Written entirely in Ukrainian, every single word - never a stray English word or fragment left untranslated.',
      '- No semicolons, colons, or dashes (–, —, -), including any introduced while rephrasing.',
      '- Correct adjective-noun agreement (gender, case, and number) throughout.',
      'English translation:',
      '- A single, complete, natural sentence in sentence case, max 15 words, with no semicolons, colons, or dashes (–, —, -).',
      '- Contains every word of the target pattern, in order and otherwise unchanged, with only the minimal grammatical adjustment English requires (e.g. verb/auxiliary inflection, "a" vs "an"). If the target\'s own verb is generic (e.g. a placeholder-taking phrase like "have a look at (sth)"), never collapse it into a single more specific verb that already implies the object (e.g. "inspect (sth)") - keep the target\'s own generic verb exactly as given, and let the concrete word filling the placeholder carry the specific meaning instead (e.g. "have a look at the report", not "review the report").',
      '- Set in a specific, real situation, not a vague or abstract statement.',
      '- Single spaces, punctuation attached to the preceding token, and only one sensible word order once the words are shuffled.',
      'Placeholders:',
      '- Replace every parenthesized placeholder in the target with a concrete word; never output the placeholder text itself.',
      '</requirements>',
      `<items>${JSON.stringify(items)}</items>`,
    ].join('\n'),
  });

  if (!tasksMatchRequestedItems(output, items)) {
    throw Exception.internalServer(
      `Generated ${UserVocabularyItemTaskType.TranslateUkrainianSentence} tasks do not match the requested vocabulary items`,
    );
  }

  const cost = {
    taskType: UserVocabularyItemTaskType.TranslateUkrainianSentence,
    costInNanoDollars: gpt56Luna.calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { tasks: output, cost };
};
