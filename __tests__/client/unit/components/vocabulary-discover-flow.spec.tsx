import type { ComponentType } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route } from '@/routes/_auth/vocabulary-lists_.$userVocabularyListId_.discover';
import { LearningStatus } from '@/const/vocabulary';
import type { z } from '@hono/zod-openapi';
import type { userVocabularyItemWithRelationsDto } from '@/server/user-vocabulary/dtos/user-vocabulary-item-with-relations.dto';
import { api } from '../../utils/api.utils';
import { mockServer } from '../../setup-unit-context';

type UserVocabularyItem = z.infer<typeof userVocabularyItemWithRelationsDto>;

const { userVocabularyListId } = vi.hoisted(() => ({ userVocabularyListId: crypto.randomUUID() }));

// Route.useParams() normally reads real router context, which only exists under a mounted
// <RouterProvider>; stubbing it lets the page component render standalone in a test without
// pulling in a full router harness for a bug that lives entirely in the component's own state
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actualRouterModule = await importOriginal<typeof import('@tanstack/react-router')>();

  return {
    ...actualRouterModule,
    createFileRoute: ((routePath: string) => {
      const createRoute = actualRouterModule.createFileRoute(routePath as never);

      return (options: never) => {
        const mockedRoute = createRoute(options);
        mockedRoute.useParams = (() => ({ userVocabularyListId })) as typeof mockedRoute.useParams;

        return mockedRoute;
      };
    }) as unknown as typeof actualRouterModule.createFileRoute,
  };
});

const createVocabularyItem = (value: string): UserVocabularyItem => {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    vocabularyItemId: crypto.randomUUID(),
    encounterCount: 0,
    status: LearningStatus.Waiting,
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

describe('Vocabulary discover page', () => {
  const renderDiscoverPage = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const DiscoverPage = Route.options.component as ComponentType;

    return render(
      <QueryClientProvider client={queryClient}>
        <DiscoverPage />
      </QueryClientProvider>,
    );
  };

  afterEach(() => cleanup());

  it('sends only one discover request when the button is clicked twice in a row, and does not surface an error', async () => {
    const [firstItem, secondItem] = [createVocabularyItem('first'), createVocabularyItem('second')];
    mockServer.addHandlers(api.vocabularyListDiscoverItems.ok(userVocabularyListId, [firstItem, secondItem]));

    const discoverHandler = vi.fn((userVocabularyItemId: string) => {
      // a real server would reject a second concurrent request for the same item with a 409
      // conflict ("already been discovered"); the client-side guard under test must never let
      // that second request fire in the first place
      if (userVocabularyItemId !== firstItem.id) throw new Error('unexpected item id');

      return HttpResponse.json({ success: true, data: { ...firstItem, status: LearningStatus.Known } });
    });
    mockServer.addHandlers(api.discoverUserVocabularyItem.mock(userVocabularyListId, discoverHandler));

    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => '');

    renderDiscoverPage();

    const knowButton = await screen.findByRole('button', { name: 'I Know This' });

    // simulates a fast double click/tap: both clicks are dispatched before React has a chance
    // to re-render the button as disabled
    fireEvent.click(knowButton);
    fireEvent.click(knowButton);

    await screen.findByText('second');

    expect(discoverHandler).toHaveBeenCalledOnce();
    expect(toastErrorSpy).not.toHaveBeenCalled();
  });
});
