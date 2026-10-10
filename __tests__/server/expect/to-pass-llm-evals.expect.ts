import { expect } from 'vitest';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { claudeHaiku55 } from '@/server/utils/ai.utils';

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
      model: claudeHaiku55.model,
      providerOptions: { openrouter: { reasoning: { effort: 'low' } } },
      output: Output.object({
        schema: z.object({
          issues: z.array(z.object({ idx: z.number(), message: z.string() })),
        }),
      }),
      instructions: [
        '# Task',
        'Validate the input against the evals, the way a schema validator checks a value against its schema.',
        '',
        '# Input',
        '- The user message is a JSON object with `input` and `evals`.',
        '- `evals` is a list of `{ idx, eval }`.',
        '',
        '# Instructions',
        '- An eval fails if the input contradicts it or lacks what it requires.',
        '- Apply each eval exactly as written, no stricter and no looser.',
        '- Report only real failures of the given evals, nothing else.',
        '',
        '# Output',
        '',
        '## issues',
        '- Add one item per failed eval.',
        '- Leave it empty if every eval passes.',
        '',
        '## issues[].idx',
        '- Use the `idx` of the failed eval.',
        '',
        '## issues[].message',
        '- Say what is wrong, with the evidence: the wrong value, or that it is missing.',
      ].join('\n'),
      prompt: [
        '# Input',
        '```json',
        JSON.stringify({ input, evals: evals.map((item, idx) => ({ idx, eval: item })) }),
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
