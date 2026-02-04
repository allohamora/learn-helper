import { expect } from 'vitest';
import { OPENAI_API_KEY } from 'astro:env/server';
import { generateText, Output } from 'ai';
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
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: z.object({
          reason: z.string().nullable(),
          satisfies: z.boolean(),
          actual: z.string().nullable(),
          expected: z.string().nullable(),
        }),
      }),
      prompt: [
        '# Task',
        'Compare the input against the statements and determine whether all statements are satisfied.',
        '',
        '## Output Requirements',
        '- `reason`: explanation if the input does not satisfy the statements.',
        '- `satisfies`: boolean indicating if the input satisfies all the statements.',
        '- `actual`: stringified JSON of the actual value that failed the constraint (extract only the relevant part in the same json format as expected, example: [{"id":1,"value":{"key":"value"}}]).',
        '- `expected`: stringified JSON of the expected value that would satisfy the constraint (extract only the relevant part in the same json format as actual, example: [{"id":1,"value":{"key":"value"}}]).',
        '',
        '## Input',
        '```json',
        JSON.stringify(input),
        '```',
        '',
        '## Statements',
        '```json',
        JSON.stringify(statements),
        '```',
      ].join('\n'),
    });

    return {
      pass: output.satisfies,
      actual: output.actual,
      expected: output.expected,
      message: () =>
        !output.satisfies
          ? `Expected object to satisfy constraints, but it doesn't. ${output.reason || ''}`
          : 'Object satisfies all constraints',
    };
  },
});
