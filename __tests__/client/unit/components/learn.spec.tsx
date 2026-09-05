import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Learn, toClientTasks, toServerTasks } from '@/components/learn';
import { EditVocabularyItemTranslationProvider } from '@/components/providers/edit-vocabulary-item-translation';
import { EventType, UserVocabularyItemTaskType } from '@/const/event';
import type { LearnItem, LearnTasksData } from '@/types/learn';
import { mockServer } from '../../setup-unit-context';

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
  it('generates every client task family with a spelling fallback for missing pronunciation audio', () => {
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
    const pronunciationTasks = tasks.filter(
      (task) => task.type === UserVocabularyItemTaskType.PronunciationToVocabularyItem,
    );
    expect(pronunciationTasks).toHaveLength(2);

    const spellingTask = pronunciationTasks.find((task) => task.data.vocabularyItem === 'second');
    expect(spellingTask).toMatchObject({
      data: {
        spelling: 'second',
        pronunciation: null,
      },
    });
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

// happy-dom exposes visibilityState as a prototype getter, not an own property, so
// getOwnPropertyDescriptor(document, 'visibilityState') is undefined by default - restoring via
// `if (original) defineProperty(...)` would then be a no-op and leave the own property (and thus
// 'hidden') stuck on document for every later test in the file. Falling back to `delete` restores
// the real default instead.
const restoreVisibilityState = (original: PropertyDescriptor | undefined) => {
  if (original) {
    Object.defineProperty(document, 'visibilityState', original);
  } else {
    delete (document as { visibilityState?: string }).visibilityState;
  }
};

describe('Learn duration reporting', () => {
  afterEach(() => cleanup());

  const renderLearn = (userVocabularyListId: string) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return render(
      <QueryClientProvider client={queryClient}>
        <EditVocabularyItemTranslationProvider userVocabularyListId={userVocabularyListId}>
          <Learn userVocabularyListId={userVocabularyListId} />
        </EditVocabularyItemTranslationProvider>
      </QueryClientProvider>,
    );
  };

  it('excludes hidden-tab time from the reported task duration', async () => {
    const BASE_NOW = 1_000_000;
    const userVocabularyListId = crypto.randomUUID();
    // toClientTasks always puts the (unshuffled) showcase task first, so the first task shown is
    // this single item's "Next" card - the simplest task to complete without extra interaction.
    const item = learnItem({ id: crypto.randomUUID(), value: 'apple', pronunciation: null });

    mockServer.addHandlers(
      http.get(`/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/learn/items`, () =>
        HttpResponse.json({ success: true, data: [item] }),
      ),
      http.get(`/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/learn/tasks`, () =>
        HttpResponse.json({
          success: true,
          data: { translateEnglishSentenceTasks: [], translateUkrainianSentenceTasks: [] } satisfies LearnTasksData,
        }),
      ),
    );

    const onEvents = vi.fn();
    mockServer.addHandlers(
      http.post(`/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/learn/events`, async ({ request }) => {
        onEvents(await request.json());
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(BASE_NOW);

    try {
      renderLearn(userVocabularyListId);
      const nextButton = await screen.findByRole('button', { name: /next/i });

      // 3 minutes on the card...
      dateNowSpy.mockReturnValue(BASE_NOW + 3 * 60_000);
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      fireEvent(document, new Event('visibilitychange'));

      // ...tab hidden for a while, must not count...
      dateNowSpy.mockReturnValue(BASE_NOW + 30 * 60_000);
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      fireEvent(document, new Event('visibilitychange'));

      // ...then another 3 minutes, for a total of 6.
      dateNowSpy.mockReturnValue(BASE_NOW + 33 * 60_000);
      fireEvent.click(nextButton);

      await waitFor(() =>
        expect(onEvents).toHaveBeenCalledExactlyOnceWith({
          events: [
            {
              type: EventType.UserVocabularyItemTaskShowcaseViewed,
              userVocabularyItemId: item.id,
              durationMs: 6 * 60_000,
            },
          ],
        }),
      );
    } finally {
      dateNowSpy.mockRestore();
      restoreVisibilityState(originalVisibilityState);
    }
  });

  it("does not roll time spent on a finished task into the next task's reported duration", async () => {
    const BASE_NOW = 1_000_000;
    const userVocabularyListId = crypto.randomUUID();
    // toShowcaseTasks maps items in order, unshuffled, so with two items the first two tasks
    // shown are both Showcase cards - the simplest way to complete two tasks back to back.
    const [firstItem, secondItem] = [
      learnItem({ id: crypto.randomUUID(), value: 'apple', pronunciation: null }),
      learnItem({ id: crypto.randomUUID(), value: 'banana', pronunciation: null }),
    ];

    mockServer.addHandlers(
      http.get(`/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/learn/items`, () =>
        HttpResponse.json({ success: true, data: [firstItem, secondItem] }),
      ),
      http.get(`/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/learn/tasks`, () =>
        HttpResponse.json({
          success: true,
          data: { translateEnglishSentenceTasks: [], translateUkrainianSentenceTasks: [] } satisfies LearnTasksData,
        }),
      ),
    );

    const onEvents = vi.fn();
    mockServer.addHandlers(
      http.post(`/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/learn/events`, async ({ request }) => {
        onEvents(await request.json());
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(BASE_NOW);

    try {
      renderLearn(userVocabularyListId);

      // 1 minute on the first card before moving on.
      dateNowSpy.mockReturnValue(BASE_NOW + 60_000);
      fireEvent.click(await screen.findByRole('button', { name: /next/i }));
      await waitFor(() => expect(onEvents).toHaveBeenCalledTimes(1));

      // Only 5s on the second card - must not include the minute spent on the first.
      dateNowSpy.mockReturnValue(BASE_NOW + 65_000);
      fireEvent.click(await screen.findByRole('button', { name: /next/i }));
      await waitFor(() => expect(onEvents).toHaveBeenCalledTimes(2));

      expect(onEvents).toHaveBeenNthCalledWith(1, {
        events: [
          {
            type: EventType.UserVocabularyItemTaskShowcaseViewed,
            userVocabularyItemId: firstItem.id,
            durationMs: 60_000,
          },
        ],
      });
      expect(onEvents).toHaveBeenNthCalledWith(2, {
        events: [
          {
            type: EventType.UserVocabularyItemTaskShowcaseViewed,
            userVocabularyItemId: secondItem.id,
            durationMs: 5_000,
          },
        ],
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });
});
