import '@tanstack/react-start/server-only';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { gpt6Luna } from '../utils/ai.utils';
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
    model: gpt6Luna.model,
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
      '# Task',
      `Create exactly ${items.length} English-to-Ukrainian word-order tasks, one per item. Output id = item.id, sentence = English, translation = Ukrainian.`,
      '# Rules',
      '- Both `sentence` and `translation` are complete, natural sentences (subject and verb) in sentence case, max 15 words each, set in a specific real situation.',
      '- The English `sentence` contains every word of the item value, in order, never reordered or replaced with synonyms. Use the exact form of the value whenever the sentence allows, and inflect only when grammar requires it (verb or auxiliary forms, "a"/"an"). Keep a generic verb as given instead of a more specific one.',
      "- Replace each parenthesized placeholder with a pronoun when one fits, otherwise a single short concrete word, so the value's own words stay together, and insert no other words between them. Never output the placeholder.",
      '- The Ukrainian `translation` is natural and idiomatic, not a word-for-word rendering, written entirely in Ukrainian, with correct adjective-noun agreement.',
      '- Never use semicolons, colons, or any dash or hyphen character (–, —, -) in either field, including any hyphen inside a word or name (e.g. "по-перше", "well-known") and any dash standing in for a missing verb. Keep each sentence to one clause: reword, and pick a different word or name when one needs a hyphen.',
      '- Pronouns, prepositions, conjunctions, and particles are separate tokens. Single spaces, punctuation attached to the preceding token, and only one sensible word order once shuffled.',
      '# Items',
      '```json',
      JSON.stringify(items),
      '```',
    ].join('\n'),
  });

  if (!tasksMatchRequestedItems(output, items)) {
    throw Exception.internalServer(
      `Generated ${UserVocabularyItemTaskType.TranslateEnglishSentence} tasks do not match the requested vocabulary items`,
    );
  }

  const cost = {
    taskType: UserVocabularyItemTaskType.TranslateEnglishSentence,
    costInNanoDollars: gpt6Luna.calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { tasks: output, cost };
};

export const toTranslateUkrainianSentence = async (items: VocabularyItemData[]) => {
  const { output, usage } = await generateText({
    model: gpt6Luna.model,
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
      '# Task',
      `Create exactly ${items.length} Ukrainian-to-English word-order tasks, one per item. Output id = item.id, sentence = Ukrainian, translation = English.`,
      '# Rules',
      '- Both `sentence` and `translation` are complete, natural sentences (subject and verb) in sentence case, max 15 words each, set in a specific real situation.',
      '- The English `translation` contains every word of the item value, in order, never reordered or replaced with synonyms. Use the exact form of the value whenever the sentence allows, and inflect only when grammar requires it (verb or auxiliary forms, "a"/"an"). Keep a generic verb as given instead of a more specific one.',
      "- Replace each parenthesized placeholder with a pronoun when one fits, otherwise a single short concrete word, so the value's own words stay together, and insert no other words between them. Never output the placeholder.",
      '- The Ukrainian `sentence` is natural and idiomatic, not a word-for-word rendering, written entirely in Ukrainian, with correct adjective-noun agreement.',
      '- Never use semicolons, colons, or any dash or hyphen character (–, —, -) in either field, including any hyphen inside a word or name (e.g. "по-перше", "well-known") and any dash standing in for a missing verb. Keep each sentence to one clause: reword, and pick a different word or name when one needs a hyphen.',
      '- Pronouns, prepositions, conjunctions, and particles are separate tokens. Single spaces, punctuation attached to the preceding token, and only one sensible word order once shuffled.',
      '# Items',
      '```json',
      JSON.stringify(items),
      '```',
    ].join('\n'),
  });

  if (!tasksMatchRequestedItems(output, items)) {
    throw Exception.internalServer(
      `Generated ${UserVocabularyItemTaskType.TranslateUkrainianSentence} tasks do not match the requested vocabulary items`,
    );
  }

  const cost = {
    taskType: UserVocabularyItemTaskType.TranslateUkrainianSentence,
    costInNanoDollars: gpt6Luna.calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { tasks: output, cost };
};
