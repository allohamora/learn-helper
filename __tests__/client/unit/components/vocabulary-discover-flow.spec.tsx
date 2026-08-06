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
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();

  return {
    ...actual,
    createFileRoute: ((path: string) => {
      const createRoute = actual.createFileRoute(path as never);

      return (options: never) => {
        const route = createRoute(options);
        route.useParams = (() => ({ userVocabularyListId })) as typeof route.useParams;

        return route;
      };
    }) as unknown as typeof actual.createFileRoute,
  };
});

const item = (value: string): UserVocabularyItem => {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    vocabularyItemId: crypto.randomUUID(),
    encounterCount: 0,
    status: LearningStatus.Waiting,
    enqueuedAt: null,
    createdAt: now,
    updatedAt: now,
    vocabularyItem: {
      id: crypto.randomUUID(),
      value,
      definition: `${value} definition`,
      uaTranslation: `${value} translation`,
      partOfSpeech: null,
      spelling: value,
      pronunciation: null,
      link: null,
      createdAt: now,
      updatedAt: now,
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
    const [first, second] = [item('first'), item('second')];
    mockServer.addHandlers(api.vocabularyListDiscoverItems.ok(userVocabularyListId, [first, second]));

    const discover = vi.fn((userVocabularyItemId: string) => {
      // a real server would reject a second concurrent request for the same item with a 409
      // conflict ("already been discovered"); the client-side guard under test must never let
      // that second request fire in the first place
      if (userVocabularyItemId !== first.id) throw new Error('unexpected item id');

      return HttpResponse.json({ success: true, data: { ...first, status: LearningStatus.Known } });
    });
    mockServer.addHandlers(api.discoverUserVocabularyItem.mock(userVocabularyListId, discover));

    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => '');

    renderDiscoverPage();

    const knowButton = await screen.findByRole('button', { name: 'I Know This' });

    // simulates a fast double click/tap: both clicks are dispatched before React has a chance
    // to re-render the button as disabled
    fireEvent.click(knowButton);
    fireEvent.click(knowButton);

    await screen.findByText('second');

    expect(discover).toHaveBeenCalledOnce();
    expect(toastErrorSpy).not.toHaveBeenCalled();
  });
});
