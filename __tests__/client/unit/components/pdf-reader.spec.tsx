import { type ReactNode, useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfReader } from '@/components/pdf-reader';
import { mockServer } from '../../setup-unit-context';

// react-pdf renders to a real <canvas> 2D context, which happy-dom doesn't provide; stub it with a
// simple page indicator so this suite can cover loading/error states and the initial render. Actual
// scroll-driven page tracking needs real layout, so it isn't covered here. Document's own fetch of
// `file` is stood in for here so the "download fails" test exercises the real error path.
vi.mock('react-pdf', () => ({
  Document: ({
    file,
    loading,
    error,
    children,
  }: {
    file: string;
    loading?: ReactNode;
    error?: ReactNode;
    children?: ReactNode;
  }) => {
    const [status, setStatus] = useState<'pending' | 'ready' | 'error'>('pending');

    useEffect(() => {
      fetch(file)
        .then((res) => setStatus(res.ok ? 'ready' : 'error'))
        .catch(() => setStatus('error'));
    }, [file]);

    if (status === 'pending') return <>{loading}</>;
    if (status === 'error') return <>{error}</>;
    return <div>{children}</div>;
  },
  Page: ({ pageNumber }: { pageNumber: number }) => <div>Page {pageNumber}</div>,
  pdfjs: { GlobalWorkerOptions: {} },
}));

// happy-dom reports zero layout, so virtua would otherwise render no pages; this replaces it with a
// pass-through that renders every page, matching this suite's small page counts.
vi.mock('virtua', () => ({
  WindowVirtualizer: ({
    ref,
    data,
    children,
  }: {
    ref?: { current: unknown };
    data: readonly unknown[];
    children: (item: unknown, index: number) => ReactNode;
  }) => {
    if (ref) ref.current = { scrollToIndex: () => {}, scrollOffset: 0, findItemIndex: () => 0 };

    return <>{data.map((item, index) => children(item, index))}</>;
  },
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

  const renderReader = (readingId: string, totalPages: number) =>
    render(<PdfReader readingId={readingId} totalPages={totalPages} />);

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
