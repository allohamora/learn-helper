import { expect } from 'vitest';
import { OPENAI_API_KEY } from 'astro:env/server';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

type CustomMatchers = {
  toSatisfyStatements: (statements: string[]) => Promise<void>;
};

declare module 'vitest' {
  /* eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-object-type */
  interface Matchers extends CustomMatchers {}
}

const openai = createOpenAI({
  apiKey: OPENAI_API_KEY,
});

const model = openai('gpt-5-nano');

expect.extend({
  toSatisfyStatements: async (input, statements) => {
    const { object } = await generateObject({
      model,
      output: 'object',
      schema: z.object({
        reason: z.string().nullable().optional(),
        satisfies: z.boolean(),
        expected: z.any().optional(),
      }),
      prompt: [
        'Compare the following input against the provided statements and determine if the input satisfies all the statements.',
        '',
        'Input:',
        '```json',
        JSON.stringify(input),
        '```',
        '',
        'Statements:',
        '```json',
        JSON.stringify(statements),
        '```',
        '',
        'Respond with a JSON object with the following properties:',
        '- reason: explanation if the input does not satisfy the statements (optional)',
        '- satisfies: boolean indicating if the input satisfies all the statements',
        '- expected: if satisfies is false, provide a corrected version of the input that satisfies all statements (optional)',
      ].join('\n'),
    });

    return {
      pass: object.satisfies,
      actual: input,
      expected: object.expected,
      message: () =>
        !object.satisfies
          ? `Expected object to satisfy constraints, but it doesn't. ${object.reason || ''}`
          : 'Object satisfies all constraints',
    };
  },
});
