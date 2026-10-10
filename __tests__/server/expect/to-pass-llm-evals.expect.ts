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
          results: z.array(z.object({ idx: z.number().int(), reason: z.string(), isPassed: z.boolean() })),
        }),
      }),
      instructions: [
        '# Task',
        '- Validate the input against the evals, the way a schema validator checks a value against its schema.',
        '',
        '# Input',
        '- The user message is a JSON object with `input` and `evals`.',
        '- `evals` is a list of `{ idx, eval }`.',
        '',
        '# Instructions',
        '- An eval fails if the input contradicts it or lacks what it requires.',
        '- Apply each eval exactly as written, no stricter and no looser.',
        '',
        '# Output',
        '',
        '## results',
        '- Return one item per eval, in the same order as the `evals` input.',
        '',
        '## results[].idx',
        '- Copy the `idx` of the eval exactly as given, never invent one.',
        '',
        '## results[].reason',
        '- Explain why the eval passes or does not pass, never just that it does or does not.',
        '- Give the evidence, like the wrong value, what is missing, etc.',
        '',
        '## results[].isPassed',
        '- `true` if the eval passes, `false` if it does not pass.',
      ].join('\n'),
      prompt: [
        '# Input',
        '```json',
        JSON.stringify({ input, evals: evals.map((item, idx) => ({ idx, eval: item })) }),
        '```',
      ].join('\n'),
    });

    const issues = output.results
      .map(({ idx, reason, isPassed }) => `${isPassed ? '✔' : '✖'} ${evals[idx]}\n  → ${reason}`)
      .join('\n');

    const idxs = output.results.map(({ idx }) => idx);
    const hasAllEvals =
      idxs.length === evals.length &&
      new Set(idxs).size === evals.length &&
      evals.every((_, idx) => idxs.includes(idx));

    return {
      pass: hasAllEvals && output.results.every(({ isPassed }) => isPassed),
      message: () =>
        `expected ${this.utils.printReceived(input)} to pass evals${hasAllEvals ? '' : ` (the judge returned ${idxs.length} of ${evals.length} results, idxs: ${this.utils.printReceived(idxs)})`}${issues ? `:\n\n${issues}\n` : '.'}`,
    };
  },
});
