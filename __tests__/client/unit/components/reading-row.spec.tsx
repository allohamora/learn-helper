import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadingRow } from '@/components/reading-row';
import { mockServer } from '../../setup-unit-context';

describe('ReadingRow', () => {
  const renderRow = (props: { id: string; title: string; totalPages: number; currentPage: number }) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const rootRoute = createRootRoute();
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <ReadingRow {...props} />,
    });
    const readingRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/readings/$readingId',
      component: function ReadingRouteComponent() {
        const { readingId } = readingRoute.useParams();

        return <div>Reading page for {readingId}</div>;
      },
    });

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, readingRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  };

  afterEach(() => cleanup());

  it('links the Read button to the reading detail route', async () => {
    const readingId = crypto.randomUUID();
    renderRow({ id: readingId, title: 'My Book', totalPages: 10, currentPage: 3 });

    fireEvent.click(await screen.findByRole('link', { name: 'Read' }));

    await screen.findByText(`Reading page for ${readingId}`);
  });

  it('deletes the reading after confirmation', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.delete(`/api/v1/users/me/readings/${readingId}`, () =>
        HttpResponse.json({ success: true, data: { readingId } }),
      ),
    );

    renderRow({ id: readingId, title: 'My Book', totalPages: 10, currentPage: 3 });

    fireEvent.click(await screen.findByRole('button', { name: 'Delete reading' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull());
  });
});
