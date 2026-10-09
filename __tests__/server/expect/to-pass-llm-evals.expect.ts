import { expect } from 'vitest';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { gemini25FlashLite } from '@/server/utils/ai.utils';

type CustomMatchers = {
  toPassLlmEvals: (evals: string[]) => Promise<void>;
};

declare module 'vitest' {
  /* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
  interface Matchers extends CustomMatchers {}
}

expect.extend({
  async toPassLlmEvals(input, evals) {
    const { output } = await generateText({
      model: gemini25FlashLite.model,
      // without a thinking budget this judge hallucinates evidence (quotes text that isn't in the input); removing it made false positives worse
      providerOptions: {
        openrouter: {
          reasoning: { max_tokens: 1024 },
        },
      },
      output: Output.object({
        schema: z.object({
          issues: z.array(z.object({ idx: z.number(), message: z.string() })),
        }),
      }),
      instructions: [
        '# Task',
        'Validate the input against the evals, the way a schema validator checks a value against its schema.',
        '',
        '# Rules',
        '- An eval fails if the input contradicts it or lacks what it requires.',
        '- Compare the way each eval says, whether equal, like, or anything else.',
        '- Report only real failures of the given evals, nothing else.',
        '',
        '# Output',
        '- `issues`: one item per failed eval, empty if every eval passes.',
        '- `issues[].idx`: the `idx` of the failed eval.',
        '- `issues[].message`: what is wrong, with the evidence: the wrong value, or that it is missing.',
      ].join('\n'),
      prompt: [
        '# Input',
        '```json',
        JSON.stringify(input),
        '```',
        '',
        '# Evals',
        '```json',
        JSON.stringify(evals.map((item, idx) => ({ idx, eval: item }))),
        '```',
      ].join('\n'),
    });

    const issues = output.issues.map(({ idx, message }) => `✖ ${message}\n  → ${evals[idx]}`).join('\n');

    return {
      pass: output.issues.length === 0,
      message: () => `expected ${this.utils.printReceived(input)} to pass evals${issues ? `:\n\n${issues}\n` : '.'}`,
    };
  },
});
