import { expect } from 'vitest';
import { generateText, Output } from 'ai';
import type { GoogleLanguageModelOptions } from '@ai-sdk/google';
import { google } from '@/server/utils/ai.utils';
import { z } from 'zod';

type CustomMatchers = {
  toSatisfyStatements: (statements: string[]) => Promise<void>;
};

declare module 'vitest' {
  /* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
  interface Matchers extends CustomMatchers {}
}

const model = google('gemini-3.1-flash-lite');

expect.extend({
  toSatisfyStatements: async (input, statements) => {
    const { output } = await generateText({
      model,
      // without a thinking budget this judge hallucinates evidence (quotes text that isn't in the input); removing it made false positives worse
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 1024,
          },
        } satisfies GoogleLanguageModelOptions,
      },
      output: Output.object({
        schema: z.object({
          reason: z.string().nullable(),
          satisfies: z.boolean(),
          actual: z.string().nullable(),
          expected: z.string().nullable(),
        }),
      }),
      prompt: [
        '# Role',
        'Act as a meticulous, evidence-based test evaluator.',
        '',
        '# Task',
        'Compare the input against the statements and determine whether all statements are satisfied.',
        '',
        '## Rules',
        '- Judge only what is literally present in the Input JSON. Do not infer or hallucinate content.',
        '- Only flag a statement as violated if you can quote the exact offending part of the Input JSON, from the field the statement actually refers to; otherwise treat it as satisfied.',
        '- Interpret statements leniently: accept any reasonable equivalent, not just the examples given.',
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
