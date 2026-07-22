import { describe, expect, it } from 'vitest';
import { toClientTasks, toServerTasks } from '@/components/learn';
import { UserVocabularyItemTaskType } from '@/const/event';
import type { LearnItem, LearnTasksData } from '@/types/learn';

const learnItem = ({ id, value, pronunciation }: { id: string; value: string; pronunciation: string | null }) => {
  return {
    id,
    vocabularyItem: {
      id: `vocabulary-${id}`,
      value,
      definition: `${value} definition`,
      uaTranslation: `${value} translation`,
      partOfSpeech: 'verb',
      spelling: value,
      pronunciation,
      link: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  } as LearnItem;
};

describe('Learn task conversion', () => {
  it('generates every client task family and skips missing pronunciation audio', () => {
    const tasks = toClientTasks([
      learnItem({ id: crypto.randomUUID(), value: 'first', pronunciation: 'https://example.com/first.mp3' }),
      learnItem({ id: crypto.randomUUID(), value: 'second', pronunciation: null }),
    ]);

    const counts = Object.groupBy(tasks, (task) => task.type);
    expect(counts[UserVocabularyItemTaskType.Showcase]).toHaveLength(2);
    expect(counts[UserVocabularyItemTaskType.VocabularyItemToDefinition]).toHaveLength(2);
    expect(counts[UserVocabularyItemTaskType.DefinitionToVocabularyItem]).toHaveLength(2);
    expect(counts[UserVocabularyItemTaskType.VocabularyItemToTranslation]).toHaveLength(2);
    expect(counts[UserVocabularyItemTaskType.TranslationToVocabularyItem]).toHaveLength(2);
    expect(counts[UserVocabularyItemTaskType.PronunciationToVocabularyItem]).toHaveLength(1);
  });

  it('removes sentence-ending periods for server tasks', () => {
    const id = crypto.randomUUID();
    const tasks = toServerTasks([], {
      translateEnglishSentenceTasks: [{ id, sentence: 'English sentence.', translation: 'one two three.' }],
      translateUkrainianSentenceTasks: [],
    } as LearnTasksData);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      type: UserVocabularyItemTaskType.TranslateEnglishSentence,
      data: {
        id,
        sentence: 'English sentence',
        originalWords: ['one', 'two', 'three'],
      },
    });
  });
});
