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

const createUserVocabularyItemRow = (): NonNullable<SearchResult['userVocabularyItem']> => {
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
  };
};

const createSearchResult = (
  value: string,
  vocabularyListItem: SearchResult['vocabularyListItem'] = null,
  userVocabularyItem: SearchResult['userVocabularyItem'] = vocabularyListItem ? createUserVocabularyItemRow() : null,
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
    userVocabularyItem,
  };
};

const createUserVocabularyItem = (value: string): UserVocabularyItem => {
  const timestamp = new Date().toISOString();

  return {
    ...createUserVocabularyItemRow(),
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
    const addedUserVocabularyItem = createUserVocabularyItemRow();

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
              userVocabularyItem: added ? addedUserVocabularyItem : null,
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

    await screen.findByRole('button', { name: 'Remove serendipity' });
    expect(addHandler).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Add serendipity' })).toBeNull();
  });

  it('renders a Remove button directly when the word is already in the list', async () => {
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

    await screen.findByRole('button', { name: 'Remove ubiquitous' });
    expect(screen.queryByRole('button', { name: 'Add ubiquitous' })).toBeNull();
  });

  it('does not show a reset progress checkbox for a brand-new word', async () => {
    const userVocabularyListId = crypto.randomUUID();
    const item = createSearchResult('serendipity');

    mockServer.addHandlers(api.personalVocabularyItemSearch.ok(userVocabularyListId, [item]));

    renderDialog(userVocabularyListId);
    await openDialogAndSearch('serendipity');

    await screen.findByRole('button', { name: 'Add serendipity' });
    expect(screen.queryByRole('checkbox', { name: /reset progress/i })).toBeNull();
  });

  it('shows a reset progress checkbox checked by default for a previously removed word, and unchecking it sends resetProgress: false', async () => {
    const userVocabularyListId = crypto.randomUUID();
    const item = createSearchResult('serendipity', null, createUserVocabularyItemRow());

    mockServer.addHandlers(api.personalVocabularyItemSearch.ok(userVocabularyListId, [item]));

    const addHandler = vi.fn((vocabularyItemId: string) => {
      if (vocabularyItemId !== item.id) throw new Error('unexpected vocabulary item id');

      return HttpResponse.json({ success: true, data: createUserVocabularyItem(item.value) });
    });
    mockServer.addHandlers(api.addVocabularyItemToPersonalList.mock(userVocabularyListId, addHandler));

    renderDialog(userVocabularyListId);
    await openDialogAndSearch('serendipity');

    const checkbox = await screen.findByRole('checkbox', { name: /reset progress/i });
    expect(checkbox.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(checkbox);
    expect(checkbox.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(await screen.findByRole('button', { name: 'Add serendipity' }));

    await vi.waitFor(() => expect(addHandler).toHaveBeenCalledWith(item.id, false));
  });

  it('removing a word unlinks it and flips the row back to Add, after confirmation', async () => {
    const userVocabularyListId = crypto.randomUUID();
    const item = createSearchResult('serendipity', {
      id: crypto.randomUUID(),
      vocabularyListId: userVocabularyListId,
      vocabularyItemId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });

    let removed = false;
    mockServer.addHandlers(
      api.personalVocabularyItemSearch.mock(userVocabularyListId, () =>
        HttpResponse.json({
          success: true,
          data: [{ ...item, vocabularyListItem: removed ? null : item.vocabularyListItem }],
          pageInfo: { total: 1, count: 1 },
        }),
      ),
    );

    const removeHandler = vi.fn((userVocabularyItemId: string) => {
      if (userVocabularyItemId !== item.userVocabularyItem?.id) throw new Error('unexpected user vocabulary item id');
      removed = true;

      return HttpResponse.json({ success: true, data: { userVocabularyItemId } });
    });
    mockServer.addHandlers(api.removeVocabularyItemFromPersonalList.mock(userVocabularyListId, removeHandler));

    renderDialog(userVocabularyListId);
    await openDialogAndSearch('serendipity');

    fireEvent.click(await screen.findByRole('button', { name: 'Remove serendipity' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await screen.findByRole('button', { name: 'Add serendipity' });
    expect(removeHandler).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Remove serendipity' })).toBeNull();
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
                  userVocabularyItem: createUserVocabularyItemRow(),
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

    await screen.findByRole('button', { name: `Remove ${value}` });
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

  it('generates with the current input value even before the search debounce settles', async () => {
    const userVocabularyListId = crypto.randomUUID();
    const value = 'perspicacious';

    mockServer.addHandlers(api.personalVocabularyItemSearch.ok(userVocabularyListId, []));

    const generateHandler = vi.fn((requestedValue: string) => {
      if (requestedValue !== value) throw new Error('unexpected value');

      return HttpResponse.json({ success: true, data: createUserVocabularyItem(value) });
    });
    mockServer.addHandlers(api.generateVocabularyItem.mock(userVocabularyListId, generateHandler));

    renderDialog(userVocabularyListId);
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    const searchInput = await screen.findByPlaceholderText('Search items...');

    fireEvent.change(searchInput, { target: { value: 'p' } });
    fireEvent.change(searchInput, { target: { value } });

    fireEvent.click(screen.getByRole('button', { name: `Generate "${value}" with AI & add` }));

    await vi.waitFor(() => expect(generateHandler).toHaveBeenCalledOnce());
  });

  it('shows an error message when the search request fails', async () => {
    const userVocabularyListId = crypto.randomUUID();

    mockServer.addHandlers(
      api.personalVocabularyItemSearch.mock(userVocabularyListId, () => HttpResponse.json({}, { status: 500 })),
    );

    renderDialog(userVocabularyListId);
    await openDialogAndSearch('whatever');

    await screen.findByText('Failed to search items. Please try again.');
    expect(screen.queryByText(/No matches for/)).toBeNull();
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
