import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfReader } from '@/components/pdf-reader';
import { mockServer } from '../../setup-unit-context';

// This suite's fixtures always render 5 pages; the mock PDF below reports that many so
// onDocumentLoadSuccess resolves pageSizes for real, matching real usage.
const MOCK_PDF_PAGE_COUNT = 5;

// react-pdf renders to a real <canvas> 2D context, which happy-dom doesn't provide; stub it with a
// simple page indicator so this suite can cover loading/error states and the initial render. Actual
// scroll-driven page tracking needs real layout, so it isn't covered here. Document's own fetch of
// `file` is stood in for here so the "download fails" test exercises the real error path, and
// onLoadSuccess is invoked with a fake PDFDocumentProxy so onDocumentLoadSuccess runs for real.
vi.mock('react-pdf', () => ({
  Document: ({
    file,
    loading,
    error,
    children,
    onLoadSuccess,
  }: {
    file: string;
    loading?: ReactNode;
    error?: ReactNode;
    children?: ReactNode;
    onLoadSuccess?: (pdf: { numPages: number; getPage: (n: number) => Promise<unknown> }) => void;
  }) => {
    const [status, setStatus] = useState<'pending' | 'ready' | 'error'>('pending');
    // PdfReader passes a new onLoadSuccess closure every render; reading it via a ref (rather than
    // depending on it directly) keeps this fetch-on-mount effect from refiring on every re-render.
    const onLoadSuccessRef = useRef(onLoadSuccess);
    onLoadSuccessRef.current = onLoadSuccess;

    useEffect(() => {
      fetch(file)
        .then((res) => {
          if (!res.ok) {
            setStatus('error');
            return;
          }

          onLoadSuccessRef.current?.({
            numPages: MOCK_PDF_PAGE_COUNT,
            getPage: async () => ({ getViewport: () => ({ width: 1, height: 1 }) }),
          });
          setStatus('ready');
        })
        .catch(() => setStatus('error'));
    }, [file]);

    if (status === 'pending') return <>{loading}</>;
    if (status === 'error') return <>{error}</>;
    return <div>{children}</div>;
  },
  Page: ({ pageNumber }: { pageNumber: number }) => <div>Page {pageNumber}</div>,
  pdfjs: { GlobalWorkerOptions: {} },
}));

const { mockScrollToIndex } = vi.hoisted(() => ({ mockScrollToIndex: vi.fn() }));

// happy-dom reports zero layout, so the real virtualizer would otherwise render no pages; this
// replaces it with a pass-through that renders every page, matching this suite's small page counts.
vi.mock('@tanstack/react-virtual', () => ({
  useWindowVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => 0,
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ key: index, index, start: 0, size: 0 })),
    scrollToIndex: mockScrollToIndex,
    getVirtualItemForOffset: () => ({ index: 0 }),
    isAtEnd: () => false,
    measure: () => {},
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
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    mockScrollToIndex.mockClear();
    cleanup();
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

    expect(mockScrollToIndex).toHaveBeenCalledWith(2, { align: 'start' });
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
