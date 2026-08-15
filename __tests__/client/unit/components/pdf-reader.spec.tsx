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
  pdfjs: { GlobalWorkerOptions: {} },
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

const PAGE_HEIGHT = 1000;

describe('PdfReader', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    // happy-dom's getBoundingClientRect always returns zeros; stub it to simulate pages stacked
    // top-to-bottom so the scroll-position page-tracking logic has something meaningful to read.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const page = Number(this.getAttribute('data-page-number'));
      const top = Number.isNaN(page) ? 0 : (page - 1) * PAGE_HEIGHT;

      return {
        top,
        bottom: top + PAGE_HEIGHT,
        left: 0,
        right: 0,
        width: 0,
        height: PAGE_HEIGHT,
        x: 0,
        y: top,
      } as DOMRect;
    });
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
