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
        reason: z.string().nullable().optional().describe('explanation if the input does not satisfy the statements'),
        satisfies: z.boolean().describe('boolean indicating if the input satisfies all the statements'),
        actual: z
          .any()
          .optional()
          .describe(
            'the actual value from input that failed the constraint (extract only the relevant part in the same json format as expected)',
          ),
        expected: z
          .any()
          .optional()
          .describe(
            'the expected value that would satisfy the constraint (extract only the relevant part in the same json format as actual)',
          ),
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
      ].join('\n'),
    });

    return {
      pass: object.satisfies,
      actual: object.actual,
      expected: object.expected,
      message: () =>
        !object.satisfies
          ? `Expected object to satisfy constraints, but it doesn't. ${object.reason || ''}`
          : 'Object satisfies all constraints',
    };
  },
});
