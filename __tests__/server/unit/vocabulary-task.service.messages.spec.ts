import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  toTranslateEnglishSentence,
  toTranslateUkrainianSentence,
} from '@/server/user-vocabulary/vocabulary-task.service';
import type { VocabularyItemData } from '@/server/user-vocabulary/vocabulary-task.service';
import { mockServer } from '../setup-unit-context';

const ids = {
  a: '0198a000-0000-7000-8000-000000000001',
  b: '0198a000-0000-7000-8000-000000000002',
  c: '0198a000-0000-7000-8000-000000000003',
  unknown: '0198a000-0000-7000-8000-0000000000ff',
};

const item = (id: string): VocabularyItemData => ({ id, value: id, uaTranslation: id, partOfSpeech: null });
const task = (id: string) => ({ id, sentence: `sentence-${id}`, translation: `translation-${id}` });

const mockModelTasks = (tasks: ReturnType<typeof task>[]) => {
  mockServer.addHandlers(
    http.post('https://openrouter.ai/api/v1/chat/completions', () =>
      HttpResponse.json({
        id: 'gen-1',
        object: 'chat.completion',
        created: 0,
        model: 'openai/gpt-6-luna',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: JSON.stringify({ elements: tasks }) },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    ),
  );
};

describe('vocabulary-task.service mismatch messages', () => {
  const items = [item(ids.a), item(ids.b), item(ids.c)];

  it.each([
    ['toTranslateEnglishSentence', toTranslateEnglishSentence, 'translate-english-sentence'],
    ['toTranslateUkrainianSentence', toTranslateUkrainianSentence, 'translate-ukrainian-sentence'],
  ])('%s names the task type', async (_name, generate, taskType) => {
    mockModelTasks([task(ids.a)]);

    await expect(generate(items)).rejects.toThrow(
      `Generated ${taskType} tasks do not match the requested vocabulary items`,
    );
  });

  it('reports an unknown id when the count matches', async () => {
    mockModelTasks([task(ids.a), task(ids.b), task(ids.unknown)]);

    await expect(toTranslateEnglishSentence(items)).rejects.toThrow(
      `(unknown ids: ${ids.unknown}; missing ids: ${ids.c})`,
    );
  });

  it('reports a duplicated id when the count matches', async () => {
    mockModelTasks([task(ids.a), task(ids.a), task(ids.b)]);

    await expect(toTranslateEnglishSentence(items)).rejects.toThrow(
      `(missing ids: ${ids.c}; duplicated ids: ${ids.a})`,
    );
  });

  it('reports the count and the missing ids when tasks are dropped', async () => {
    mockModelTasks([task(ids.a)]);

    await expect(toTranslateEnglishSentence(items)).rejects.toThrow(
      `(requested 3, returned 1; missing ids: ${ids.b}, ${ids.c})`,
    );
  });

  it('reports the count when extra tasks are returned', async () => {
    mockModelTasks([task(ids.a), task(ids.b), task(ids.c), task(ids.unknown)]);

    await expect(toTranslateEnglishSentence(items)).rejects.toThrow(
      `(requested 3, returned 4; unknown ids: ${ids.unknown})`,
    );
  });
});
