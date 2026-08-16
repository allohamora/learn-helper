import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfReader } from '@/components/pdf-reader';
import { mockServer } from '../../setup-unit-context';

// react-pdf renders to a real <canvas> 2D context, which happy-dom doesn't provide; stub it with a
// simple page indicator so this suite can cover loading/error states and the initial render. Actual
// scroll-driven page tracking needs real layout, so it isn't covered here.
vi.mock('react-pdf', () => ({
  Document: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Page: ({ pageNumber }: { pageNumber: number }) => <div>Page {pageNumber}</div>,
  pdfjs: {
    GlobalWorkerOptions: {},
    // stands in for parsing the (fake) downloaded bytes to read each page's real size up front
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 5,
        getPage: async () => ({ getViewport: () => ({ width: 600, height: 800 }) }),
      }),
    }),
  },
}));

// happy-dom reports zero layout, so react-virtual would otherwise render no pages; this replaces it
// with a pass-through that renders every page, matching this suite's small page counts.
vi.mock('@tanstack/react-virtual', () => ({
  useWindowVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getTotalSize: () => count * estimateSize(),
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, start: index * estimateSize(), key: index })),
    scrollToIndex: () => {},
    scrollOffset: 0,
  }),
}));

class MockResizeObserver {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [{ target, contentRect: { width: 600, height: 0 } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  unobserve() {}
  disconnect() {}
}

describe('PdfReader', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderReader = (readingId: string, totalPages: number) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return render(
      <QueryClientProvider client={queryClient}>
        <PdfReader readingId={readingId} totalPages={totalPages} />
      </QueryClientProvider>,
    );
  };

  it('shows page 1 and the total page count once loaded', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );

    renderReader(readingId, 5);

    await screen.findByText('Page 1');
    screen.getByText('Page 5');
    expect((screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement).value).toBe('1');
    screen.getByText('/ 5');
  });

  it('jumps to a page typed into the page input', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );

    renderReader(readingId, 5);
    await screen.findByText('Page 1');

    const input = screen.getByRole('textbox', { name: 'Page number' });
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
  });

  it('shows an error message when the download fails', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () => HttpResponse.json(null, { status: 500 })),
    );

    renderReader(readingId, 5);

    await screen.findByText('Failed to load the PDF. Please try again.');
  });
});
