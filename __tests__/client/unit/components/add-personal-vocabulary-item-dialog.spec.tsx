import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from '@hono/zod-openapi';
import { AddPersonalVocabularyItemDialog } from '@/components/add-personal-vocabulary-item-dialog';
import { LearningStatus } from '@/const/vocabulary';
import type { personalVocabularyItemSearchResultDto } from '@/server/user-vocabulary/dtos/personal-vocabulary-item-search-result.dto';
import type { userVocabularyItemWithRelationsDto } from '@/server/user-vocabulary/dtos/user-vocabulary-item-with-relations.dto';
import { api } from '../../utils/api.utils';
import { mockServer } from '../../setup-unit-context';

type SearchResult = z.infer<typeof personalVocabularyItemSearchResultDto>;
type UserVocabularyItem = z.infer<typeof userVocabularyItemWithRelationsDto>;

const createSearchResult = (
  value: string,
  vocabularyListItem: SearchResult['vocabularyListItem'] = null,
): SearchResult => {
  const timestamp = new Date().toISOString();

  return {
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
    vocabularyListItem,
  };
};

const createUserVocabularyItem = (value: string): UserVocabularyItem => {
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

describe('AddPersonalVocabularyItemDialog', () => {
  const renderDialog = (userVocabularyListId: string) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return render(
      <QueryClientProvider client={queryClient}>
        <AddPersonalVocabularyItemDialog userVocabularyListId={userVocabularyListId} />
      </QueryClientProvider>,
    );
  };

  const openDialogAndSearch = async (query: string) => {
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    fireEvent.change(await screen.findByPlaceholderText('Search items...'), { target: { value: query } });
  };

  afterEach(() => cleanup());

  it('shows Add for an unadded word, and adding it flips the row to Already added', async () => {
    const userVocabularyListId = crypto.randomUUID();
    const item = createSearchResult('serendipity');

    let added = false;
    mockServer.addHandlers(
      api.personalVocabularyItemSearch.mock(userVocabularyListId, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              ...item,
              vocabularyListItem: added
                ? {
                    id: crypto.randomUUID(),
                    vocabularyListId: userVocabularyListId,
                    vocabularyItemId: item.id,
                    createdAt: item.createdAt,
                  }
                : null,
            },
          ],
          pageInfo: { total: 1, count: 1 },
        }),
      ),
    );

    const addHandler = vi.fn((vocabularyItemId: string) => {
      if (vocabularyItemId !== item.id) throw new Error('unexpected vocabulary item id');
      added = true;

      return HttpResponse.json({ success: true, data: createUserVocabularyItem(item.value) });
    });
    mockServer.addHandlers(api.addVocabularyItemToPersonalList.mock(userVocabularyListId, addHandler));

    renderDialog(userVocabularyListId);
    await openDialogAndSearch('serendipity');

    fireEvent.click(await screen.findByRole('button', { name: 'Add serendipity' }));

    await screen.findByRole('button', { name: 'Added' });
    expect(addHandler).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Add serendipity' })).toBeNull();
  });

  it('renders Already added directly when the word is already in the list', async () => {
    const userVocabularyListId = crypto.randomUUID();
    const item = createSearchResult('ubiquitous', {
      id: crypto.randomUUID(),
      vocabularyListId: userVocabularyListId,
      vocabularyItemId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });

    mockServer.addHandlers(api.personalVocabularyItemSearch.ok(userVocabularyListId, [item]));

    renderDialog(userVocabularyListId);
    await openDialogAndSearch('ubiquitous');

    await screen.findByRole('button', { name: 'Added' });
    expect(screen.queryByRole('button', { name: 'Add ubiquitous' })).toBeNull();
  });

  it('shows a generate fallback for zero results, and generating adds the word', async () => {
    const userVocabularyListId = crypto.randomUUID();
    const value = 'flibbertigibbet';

    let generated = false;
    mockServer.addHandlers(
      api.personalVocabularyItemSearch.mock(userVocabularyListId, () =>
        HttpResponse.json({
          success: true,
          data: generated
            ? [
                {
                  ...createSearchResult(value),
                  vocabularyListItem: {
                    id: crypto.randomUUID(),
                    vocabularyListId: userVocabularyListId,
                    vocabularyItemId: crypto.randomUUID(),
                    createdAt: new Date().toISOString(),
                  },
                },
              ]
            : [],
          pageInfo: { total: generated ? 1 : 0, count: generated ? 1 : 0 },
        }),
      ),
    );

    const generateHandler = vi.fn((requestedValue: string) => {
      if (requestedValue !== value) throw new Error('unexpected value');
      generated = true;

      return HttpResponse.json({ success: true, data: createUserVocabularyItem(value) });
    });
    mockServer.addHandlers(api.generateVocabularyItem.mock(userVocabularyListId, generateHandler));

    renderDialog(userVocabularyListId);
    await openDialogAndSearch(value);
    await screen.findByText(`No matches for “${value}”.`);

    fireEvent.click(await screen.findByRole('button', { name: `Generate "${value}" with AI & add` }));

    await screen.findByRole('button', { name: 'Added' });
    expect(generateHandler).toHaveBeenCalledOnce();
  });

  it('sends the context field to the generate endpoint when provided', async () => {
    const userVocabularyListId = crypto.randomUUID();
    const value = 'gobbledygook';
    const context = 'The contract was full of gobbledygook nobody could parse.';

    mockServer.addHandlers(api.personalVocabularyItemSearch.ok(userVocabularyListId, []));

    const generateHandler = vi.fn((requestedValue: string, requestedContext: string | undefined) => {
      if (requestedValue !== value || requestedContext !== context) throw new Error('unexpected request body');

      return HttpResponse.json({ success: true, data: createUserVocabularyItem(value) });
    });
    mockServer.addHandlers(api.generateVocabularyItem.mock(userVocabularyListId, generateHandler));

    renderDialog(userVocabularyListId);
    await openDialogAndSearch(value);
    await screen.findByText(`No matches for “${value}”.`);

    fireEvent.change(screen.getByPlaceholderText('Context for AI generation'), {
      target: { value: context },
    });
    fireEvent.click(await screen.findByRole('button', { name: `Generate "${value}" with AI & add` }));

    await vi.waitFor(() => expect(generateHandler).toHaveBeenCalledOnce());
  });

  it('surfaces a toast and keeps the Add button enabled when adding fails', async () => {
    const userVocabularyListId = crypto.randomUUID();
    const item = createSearchResult('quixotic');

    mockServer.addHandlers(api.personalVocabularyItemSearch.ok(userVocabularyListId, [item]));
    mockServer.addHandlers(
      api.addVocabularyItemToPersonalList.mock(userVocabularyListId, () => HttpResponse.json({}, { status: 500 })),
    );

    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => '');

    renderDialog(userVocabularyListId);
    await openDialogAndSearch('quixotic');

    const addButton = (await screen.findByRole('button', { name: 'Add quixotic' })) as HTMLButtonElement;
    fireEvent.click(addButton);

    await vi.waitFor(() => expect(toastErrorSpy).toHaveBeenCalledWith('Failed to add item'));
    expect(addButton.disabled).toBe(false);
  });
});
