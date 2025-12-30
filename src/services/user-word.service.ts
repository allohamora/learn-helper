import {
  decreaseMaxWordsToUnlock,
  getMaxWordsToUnlock,
  getUserWordById,
  updateUserWord,
  updateUserWordStatus,
} from '@/repositories/user-word.repository';
import type { AuthParams } from '@/types/auth.types';
import { Status, TaskType, type DiscoveryStatus } from '@/types/user-words.types';
import { EventType } from '@/types/event.types';
import { db } from 'astro:db';
import { generateObject, type LanguageModelUsage } from 'ai';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { z } from 'zod';
import { GEMINI_API_KEY } from 'astro:env/server';
import { getLearningWords } from '@/repositories/user-word.repository';
import { deleteWordDiscoveredEvents, insertEvent, insertEvents } from '@/repositories/event.repository';

const REVIEW_AFTER_VALUE = 3;
const MAX_ENCOUNTER_COUNT = 3;

export const moveUserWordToNextStep = async (data: AuthParams<{ userWordId: number }>) => {
  await db.transaction(async (tx) => {
    const userWord = await getUserWordById(data, tx);
    const encounterCount = userWord.encounterCount + 1;

    await insertEvent({ type: EventType.WordMovedToNextStep, ...data }, tx);
    await decreaseMaxWordsToUnlock(data, tx);

    if (encounterCount >= MAX_ENCOUNTER_COUNT) {
      await updateUserWord({ ...data, wordsToUnlock: 0, encounterCount, status: Status.Learned }, tx);
    } else {
      const maxWordsToUnlock = await getMaxWordsToUnlock(data, tx);

      await updateUserWord({ ...data, wordsToUnlock: maxWordsToUnlock + REVIEW_AFTER_VALUE, encounterCount }, tx);
    }
  });
};

export const setDiscoveryStatus = async (
  data: AuthParams<
    { userWordId: number } & (
      | { status: Status.Waiting }
      | { status: Exclude<DiscoveryStatus, Status.Waiting>; durationMs: number }
    )
  >,
) => {
  await db.transaction(async (tx) => {
    if (data.status === Status.Waiting) {
      await deleteWordDiscoveredEvents(data, tx);
    } else {
      await insertEvent(
        {
          type: EventType.WordDiscovered,
          ...data,
        },
        tx,
      );
    }

    await updateUserWordStatus(data, tx);
  });
};

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

export type WordData = {
  id: number;
  value: string;
  partOfSpeech: string | null;
  level: string;
  definition: string;
};

export const toFillInTheGap = async (words: WordData[]) => {
  const {
    reasoning,
    object: tasks,
    usage,
  } = await generateObject({
    model,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 4096,
          includeThoughts: true,
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
    schema: z.array(
      z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        task: z.string().describe('3-15 word sentence with exactly one "___" blank replacing target word'),
        answer: z.string().describe('Exact word/phrase adapted grammatically (case-insensitive)'),
      }),
    ),
    prompt: [
      `Create exactly ${words.length} fill-in-the-gap exercises (one per input word)`,
      '',
      'Requirements:',
      '- Grammatically correct, natural, engaging and modern English sentences',
      '- Target word appears ONLY as blank',
      '- Sentences are level-appropriate: A1 simple, B1 uses conditionals/complex structures, B2+ uses advanced grammar, etc',
      '- Varied punctuation (., !, ?) based on sentence type',
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const cost = {
    taskType: TaskType.FillInTheGap,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { reasoning, tasks, cost };
};

export const toTranslateEnglishSentence = async (words: WordData[]) => {
  const {
    reasoning,
    object: tasks,
    usage,
  } = await generateObject({
    model,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 8192,
          includeThoughts: true,
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
    schema: z.array(
      z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        sentence: z.string().describe('English sentence containing target word/phrase'),
        options: z
          .array(
            z.object({
              value: z.string().describe('Complete Ukrainian sentence'),
              isAnswer: z.boolean().describe('true for 1 correct option, false for 3 wrong options'),
              description: z.string().optional().describe('ONLY wrong options (isAnswer: false) have description'),
            }),
          )
          .describe('4 options: 1 correct, 3 wrong'),
      }),
    ),
    prompt: [
      `Create exactly ${words.length} English->Ukrainian translation tasks (one per input word)`,
      '',
      'Requirements:',
      '- English sentence: 3-15 words, modern, natural',
      '- ALL Ukrainian options MUST be complete sentences with subject (pronoun/noun) and conjugated verb',
      '- ALL options: grammatically perfect with full agreement (possessives match noun case AND number)',
      '- Correct option: precisely translates English sentence',
      '- Wrong options: same topic, differ in tense/subject/details',
      '- Sentences are level-appropriate: A1 simple, B1 uses conditionals/complex structures, B2+ uses advanced grammar, etc',
      '- When generating Ukrainian text, always ensure adjective–noun agreement',
      '- Adjectives must match the noun in gender, number, and case',
      '- Do not use synonyms of the target word in any option',
      '- Do not have multiple options that are acceptable translations of the English sentence',
      "- ONLY wrong options (isAnswer: false) have description: \"Wrong [category]: '[incorrect word]' instead of '[correct word]'\" - reference specific words, not full sentences",
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const cost = {
    taskType: TaskType.TranslateEnglishSentence,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { reasoning, tasks, cost };
};

export const toTranslateUkrainianSentence = async (words: WordData[]) => {
  const {
    reasoning,
    object: tasks,
    usage,
  } = await generateObject({
    model,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 8192,
          includeThoughts: true,
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
    schema: z.array(
      z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        sentence: z.string().describe('Ukrainian sentence containing translated target word/phrase'),
        options: z
          .array(
            z.object({
              value: z.string().describe('Complete English sentence'),
              isAnswer: z.boolean().describe('true for 1 correct option, false for 3 wrong options'),
              description: z.string().optional().describe('ONLY wrong options (isAnswer: false) have description'),
            }),
          )
          .describe('4 options: 1 correct, 3 wrong'),
      }),
    ),
    prompt: [
      `Create exactly ${words.length} Ukrainian->English translation tasks (one per input word)`,
      '',
      'Requirements:',
      '- Ukrainian sentence: 3-15 words, modern, natural',
      '- ALL English options must be grammatically complete: include articles (a/an/the), prepositions, objects',
      '- Correct option: precisely translates Ukrainian sentence',
      '- Wrong options: same topic, differ in tense/subject/details',
      '- Sentences are level-appropriate: A1 simple, B1 uses conditionals/complex structures, B2+ uses advanced grammar, etc',
      '- Do not use synonyms of the target word in any option',
      '- Do not have multiple options that are acceptable translations of the English sentence',
      "- ONLY wrong options (isAnswer: false) have description: \"Wrong [category]: '[incorrect word]' instead of '[correct word]'\" - reference specific words, not full sentences",
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const cost = {
    taskType: TaskType.TranslateUkrainianSentence,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { reasoning, tasks, cost };
};

export const toSynonymAndAntonym = async (words: WordData[]) => {
  const {
    reasoning,
    object: tasks,
    usage,
  } = await generateObject({
    model,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 4096,
          includeThoughts: true,
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
    schema: z.array(
      z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        synonym: z.string(),
        antonym: z.string(),
      }),
    ),
    prompt: [
      `Create exactly ${words.length} synonym/antonym pairs based on the definition field (one per input word)`,
      '',
      'Requirements:',
      '- Same part of speech as input word',
      '- Match CEFR level: A1 words need simple synonyms (glad, large), not advanced (elated, substantial)',
      '- Use "definition" for meaning, but preserve part of speech',
      '- Never use target word itself',
      '- Use only words from the same category: modal -> modal, article -> article, preposition -> preposition',
      '- Never substitute with content words (adjectives, verbs, nouns)',
      '- If no true synonym/antonym exists at target level, create a near-synonym/antonym that closely matches meaning',
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const cost = {
    taskType: TaskType.SynonymAndAntonym,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { reasoning, tasks, cost };
};

export const toFindNonsenseSentence = async (words: WordData[]) => {
  const {
    object: tasks,
    usage,
    reasoning,
  } = await generateObject({
    model,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 4096,
          includeThoughts: true,
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
    schema: z.array(
      z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        options: z.array(
          z
            .object({
              value: z.string().describe('Sentence (3-15 words, modern, natural) containing EXACT target word/phrase'),
              isAnswer: z.boolean().describe('true for 1 nonsense sentence, false for 3 correct sentences'),
              description: z
                .string()
                .optional()
                .describe('Nonsense sentence (isAnswer: true) MUST have description field explaining why it is wrong'),
            })
            .describe('4 options: 1 nonsense, 3 correct'),
        ),
      }),
    ),
    prompt: [
      `Create exactly ${words.length} nonsense detection tasks (one per input word)`,
      '',
      'Requirements:',
      '- Correct sentences: natural, grammatically perfect, contain exact target word/phrase',
      '- Nonsense sentence: obviously absurd but MUST contain exact target word/phrase',
      '- Level-appropriate grammar; varied punctuation (., !, ?)',
      '',
      'Nonsense types:',
      '- Semantic absurdity: "The chair can swim very fast."',
      '- Logical impossibility: "I will do it yesterday."',
      '- Category mistakes: "The silence can taste purple."',
      '- Grammatical breakdown: "The book agrees with on the table."',
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const cost = {
    taskType: TaskType.FindNonsenseSentence,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { tasks, cost, reasoning };
};

export const toWordOrder = async (words: WordData[]) => {
  const {
    reasoning,
    object: tasks,
    usage,
  } = await generateObject({
    model,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 4096,
          includeThoughts: true,
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
    schema: z.array(
      z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        sentence: z
          .string()
          .describe('3-15 words, single spaces, punctuation attached to words, first word capitalized only'),
      }),
    ),
    prompt: [
      `Create exactly ${words.length} tasks word order exercises (one per input word)`,
      '',
      'Requirements:',
      '- Generate a sentence in CORRECT word order for each word/phrase',
      '- Add adjectives, adverbs, time expressions to reach minimum word count',
      '- All words separate: articles, prepositions, function words',
      '- Level-appropriate grammar; varied punctuation (., !, ?)',
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const cost = {
    taskType: TaskType.WordOrder,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { reasoning, tasks, cost };
};

export const getLearningTasks = async (body: AuthParams<{ limit: number }>) => {
  const learningWords = await getLearningWords(body);
  if (!learningWords.length) {
    return {
      fillInTheGapTasks: [],
      translateEnglishSentenceTasks: [],
      translateUkrainianSentenceTasks: [],
      synonymAndAntonymTasks: [],
      findNonsenseSentenceTasks: [],
      wordOrderTasks: [],
    };
  }

  const words = learningWords.map(
    ({ id, word }): WordData => ({
      id,
      value: word.value,
      partOfSpeech: word.partOfSpeech,
      level: word.level,
      definition: word.definition,
    }),
  );

  const [
    fillInTheGap,
    translateEnglishSentence,
    translateUkrainianSentence,
    synonymAndAntonym,
    findNonsenseSentence,
    wordOrder,
  ] = await Promise.all([
    toFillInTheGap(words),
    toTranslateEnglishSentence(words),
    toTranslateUkrainianSentence(words),
    toSynonymAndAntonym(words),
    toFindNonsenseSentence(words),
    toWordOrder(words),
  ]);

  const events = [
    fillInTheGap.cost,
    translateEnglishSentence.cost,
    translateUkrainianSentence.cost,
    synonymAndAntonym.cost,
    findNonsenseSentence.cost,
    wordOrder.cost,
  ].map((cost) => ({
    ...cost,
    type: EventType.TaskCost as const,
    userId: body.userId,
    userWordIds: learningWords.map(({ id }) => id),
  }));
  await insertEvents(events);

  return {
    fillInTheGapTasks: fillInTheGap.tasks,
    translateEnglishSentenceTasks: translateEnglishSentence.tasks,
    translateUkrainianSentenceTasks: translateUkrainianSentence.tasks,
    synonymAndAntonymTasks: synonymAndAntonym.tasks,
    findNonsenseSentenceTasks: findNonsenseSentence.tasks,
    wordOrderTasks: wordOrder.tasks,
  };
};
