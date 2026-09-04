import type { ComponentType } from 'react';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
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

  it('sends only one discover request when two click events land in the same render batch', async () => {
    const [firstItem, secondItem] = [createVocabularyItem('first'), createVocabularyItem('second')];
    mockServer.addHandlers(api.vocabularyListDiscoverItems.ok(userVocabularyListId, [firstItem, secondItem]));

    const discoverHandler = vi.fn((userVocabularyItemId: string) => {
      if (userVocabularyItemId !== firstItem.id) throw new Error('unexpected item id');

      return HttpResponse.json({ success: true, data: { ...firstItem, status: LearningStatus.Known } });
    });
    mockServer.addHandlers(api.discoverUserVocabularyItem.mock(userVocabularyListId, discoverHandler));

    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => '');

    renderDiscoverPage();

    const knowButton = await screen.findByRole('button', { name: 'I Know This' });

    // unlike two separate `fireEvent.click()` calls (each flushes/re-renders on its own),
    // dispatching both native click events inside a single `act()` call models two click
    // events landing in the same batch with no render in between - e.g. a touch device
    // firing both a synthetic and a real click for one tap. The guard must not rely on
    // `isSubmitting` state alone, since its closure value is still stale for both handlers.
    act(() => {
      knowButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      knowButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    await screen.findByText('second');

    expect(discoverHandler).toHaveBeenCalledOnce();
    expect(toastErrorSpy).not.toHaveBeenCalled();
  });

  it('excludes hidden-tab time from the reported discover duration', async () => {
    const BASE_NOW = 1_000_000;
    const [firstItem, secondItem] = [createVocabularyItem('first'), createVocabularyItem('second')];
    mockServer.addHandlers(api.vocabularyListDiscoverItems.ok(userVocabularyListId, [firstItem, secondItem]));

    const onDiscover = vi.fn();
    mockServer.addHandlers(
      http.post(
        `/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/items/:userVocabularyItemId/discover`,
        async ({ request, params }) => {
          onDiscover(params.userVocabularyItemId, await request.json());
          return HttpResponse.json({ success: true, data: { ...firstItem, status: LearningStatus.Known } });
        },
      ),
    );

    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(BASE_NOW);

    try {
      renderDiscoverPage();
      const knowButton = await screen.findByRole('button', { name: 'I Know This' });

      // 3 minutes thinking about the card...
      dateNowSpy.mockReturnValue(BASE_NOW + 3 * 60_000);
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      fireEvent(document, new Event('visibilitychange'));

      // ...tab hidden for a while, must not count...
      dateNowSpy.mockReturnValue(BASE_NOW + 30 * 60_000);
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      fireEvent(document, new Event('visibilitychange'));

      // ...then another 3 minutes thinking, for a total of 6.
      dateNowSpy.mockReturnValue(BASE_NOW + 33 * 60_000);
      fireEvent.click(knowButton);

      await screen.findByText('second');

      expect(onDiscover).toHaveBeenCalledExactlyOnceWith(firstItem.id, {
        status: LearningStatus.Known,
        durationMs: 6 * 60_000,
      });
    } finally {
      dateNowSpy.mockRestore();
      restoreVisibilityState(originalVisibilityState);
    }
  });

  it("does not roll time spent before an undo into the next item's reported duration", async () => {
    const BASE_NOW = 1_000_000;
    const [firstItem, secondItem] = [createVocabularyItem('first'), createVocabularyItem('second')];
    mockServer.addHandlers(api.vocabularyListDiscoverItems.ok(userVocabularyListId, [firstItem, secondItem]));

    const onDiscover = vi.fn();
    mockServer.addHandlers(
      http.post(
        `/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/items/:userVocabularyItemId/discover`,
        async ({ request, params }) => {
          onDiscover(params.userVocabularyItemId, await request.json());
          return HttpResponse.json({ success: true, data: { ...firstItem, status: LearningStatus.Known } });
        },
      ),
      http.post(`/api/v1/users/me/vocabulary-lists/${userVocabularyListId}/items/:userVocabularyItemId/undo`, () =>
        HttpResponse.json({ success: true, data: { ...firstItem, status: LearningStatus.Waiting } }),
      ),
    );

    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(BASE_NOW);

    try {
      renderDiscoverPage();
      const knowButton = await screen.findByRole('button', { name: 'I Know This' });

      // 1 minute on the first card before marking it known.
      dateNowSpy.mockReturnValue(BASE_NOW + 60_000);
      fireEvent.click(knowButton);
      await screen.findByText('second');

      // 5s later, undo back to the first card - this gap must not roll into the next duration.
      dateNowSpy.mockReturnValue(BASE_NOW + 65_000);
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      await screen.findByText('first');

      // Only 5s actually spent on the re-shown card.
      dateNowSpy.mockReturnValue(BASE_NOW + 70_000);
      fireEvent.click(await screen.findByRole('button', { name: 'I Know This' }));

      await waitFor(() => expect(onDiscover).toHaveBeenCalledTimes(2));
      expect(onDiscover).toHaveBeenNthCalledWith(1, firstItem.id, { status: LearningStatus.Known, durationMs: 60_000 });
      expect(onDiscover).toHaveBeenNthCalledWith(2, firstItem.id, { status: LearningStatus.Known, durationMs: 5_000 });
    } finally {
      dateNowSpy.mockRestore();
    }
  });
});
