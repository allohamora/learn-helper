import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from '@hono/zod-openapi';
import { VocabularyItemsTable, requiresResetConfirmation } from '@/components/vocabulary-items-table';
import { EditVocabularyItemTranslationProvider } from '@/components/providers/edit-vocabulary-item-translation';
import { LearningStatus, VocabularyListType } from '@/const/vocabulary';
import type { userVocabularyItemWithRelationsDto } from '@/server/user-vocabulary/dtos/user-vocabulary-item-with-relations.dto';
import { api } from '../../utils/api.utils';
import { mockServer } from '../../setup-unit-context';

// jsdom/happy-dom report zero element dimensions, so react-virtual would otherwise render no rows;
// this replaces it with a pass-through that renders every item, matching this test's single-item lists.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getTotalSize: () => count * estimateSize(),
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, start: index * estimateSize(), size: estimateSize() })),
    measureElement: () => {},
  }),
}));

type VocabularyItem = z.infer<typeof userVocabularyItemWithRelationsDto>;

const createVocabularyItem = (value: string): VocabularyItem => {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    vocabularyItemId: crypto.randomUUID(),
    encounterCount: 0,
    status: LearningStatus.Learning,
    enqueuedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    vocabularyItem: {
      id: crypto.randomUUID(),
      value,
      definition: `${value} definition`,
      uaTranslation: `${value} translation`,
      partOfSpeech: null,
      spelling: value,
      pronunciation: null,
      link: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
};

describe('requiresResetConfirmation', () => {
  it('requires confirmation when learning progress would be erased', () => {
    expect(requiresResetConfirmation(LearningStatus.Learning, 1)).toBe(true);
    expect(requiresResetConfirmation(LearningStatus.Learned, 3)).toBe(true);
  });

  it('does not require confirmation when no encounters have been completed', () => {
    expect(requiresResetConfirmation(LearningStatus.Learning, 0)).toBe(false);
    expect(requiresResetConfirmation(LearningStatus.Known, 0)).toBe(false);
  });
});

describe('VocabularyItemsTable remove dialog', () => {
  const renderTable = (userVocabularyListId: string, item: VocabularyItem) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return render(
      <QueryClientProvider client={queryClient}>
        <EditVocabularyItemTranslationProvider userVocabularyListId={userVocabularyListId}>
          <VocabularyItemsTable
            items={[item]}
            hasNextPage={false}
            isFetchingNextPage={false}
            onLoadMore={() => {}}
            userVocabularyListId={userVocabularyListId}
            vocabularyListType={VocabularyListType.Personal}
          />
        </EditVocabularyItemTranslationProvider>
      </QueryClientProvider>,
    );
  };

  afterEach(() => cleanup());

  it('shows a reset checkbox unchecked by default, and sends isReset: false', async () => {
    const userVocabularyListId = crypto.randomUUID();
    const item = createVocabularyItem('serendipity');

    const removeHandler = vi.fn((userVocabularyItemId: string) =>
      HttpResponse.json({ success: true, data: { userVocabularyItemId } }),
    );
    mockServer.addHandlers(api.removeVocabularyItemFromPersonalList.mock(removeHandler));

    renderTable(userVocabularyListId, item);

    fireEvent.click(screen.getByRole('button', { name: 'Remove from list' }));

    const checkbox = await screen.findByRole('checkbox', { name: /^reset$/i });
    expect(checkbox.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await vi.waitFor(() => expect(removeHandler).toHaveBeenCalledWith(item.id, false));
  });

  it('checking reset sends isReset: true', async () => {
    const userVocabularyListId = crypto.randomUUID();
    const item = createVocabularyItem('serendipity');

    const removeHandler = vi.fn((userVocabularyItemId: string) =>
      HttpResponse.json({ success: true, data: { userVocabularyItemId } }),
    );
    mockServer.addHandlers(api.removeVocabularyItemFromPersonalList.mock(removeHandler));

    renderTable(userVocabularyListId, item);

    fireEvent.click(screen.getByRole('button', { name: 'Remove from list' }));

    const checkbox = await screen.findByRole('checkbox', { name: /^reset$/i });
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await vi.waitFor(() => expect(removeHandler).toHaveBeenCalledWith(item.id, true));
  });

  it('resets the checkbox to unchecked after cancelling', async () => {
    const userVocabularyListId = crypto.randomUUID();
    const item = createVocabularyItem('serendipity');

    renderTable(userVocabularyListId, item);

    fireEvent.click(screen.getByRole('button', { name: 'Remove from list' }));
    const checkbox = await screen.findByRole('checkbox', { name: /^reset$/i });
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from list' }));

    const reopenedCheckbox = await screen.findByRole('checkbox', { name: /^reset$/i });
    expect(reopenedCheckbox.getAttribute('aria-checked')).toBe('false');
  });
});
