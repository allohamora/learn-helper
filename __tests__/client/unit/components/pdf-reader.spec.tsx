import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfReader } from '@/components/pdf-reader';
import { mockServer } from '../../setup-unit-context';

// This suite's fixtures always render 5 pages; the mock PDF below reports that many so
// onDocumentLoadSuccess resolves pageSizes for real, matching real usage.
const MOCK_PDF_PAGE_COUNT = 5;

// Each page's native size (in PDF points), as returned by the mocked getPage()/getViewport() below.
// Tests that care about per-page sizing (getPageWidth's 125%-of-native-size cap) mutate this before
// rendering; everything else gets the same 1x1 placeholder the old fixture used.
let mockPageViewports: { width: number; height: number }[] = [];

const resetMockPageViewports = () => {
  mockPageViewports = Array.from({ length: MOCK_PDF_PAGE_COUNT }, () => ({ width: 1, height: 1 }));
};
resetMockPageViewports();

// react-pdf renders to a real <canvas> 2D context, which happy-dom doesn't provide; stub it with a
// simple page indicator so this suite can cover loading/error states and the initial render. Document's
// own fetch of `file` is stood in for here so the "download fails" test exercises the real error path,
// and onLoadSuccess is invoked with a fake PDFDocumentProxy so onDocumentLoadSuccess runs for real.
vi.mock('react-pdf', () => ({
  Document: ({
    file,
    loading,
    error,
    children,
    onLoadSuccess,
    onItemClick,
  }: {
    file: string;
    loading?: ReactNode;
    error?: ReactNode;
    children?: ReactNode;
    onLoadSuccess?: (pdf: { numPages: number; getPage: (n: number) => Promise<unknown> }) => void;
    onItemClick?: (item: { pageIndex: number }) => void;
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
            getPage: async (pageNumber: number) => ({
              getViewport: () => mockPageViewports[pageNumber - 1] ?? { width: 1, height: 1 },
            }),
          });
          setStatus('ready');
        })
        .catch(() => setStatus('error'));
    }, [file]);

    if (status === 'pending') return <>{loading}</>;
    if (status === 'error') return <>{error}</>;
    return (
      <div>
        {/* Stands in for clicking a real internal PDF link/TOC entry, which react-pdf reports via this prop. */}
        {onItemClick && (
          <button type="button" onClick={() => onItemClick({ pageIndex: 2 })}>
            fake internal link
          </button>
        )}
        {children}
      </div>
    );
  },
  Page: ({ pageNumber, width }: { pageNumber: number; width: number }) => (
    <div data-width={Math.round(width)}>Page {pageNumber}</div>
  ),
  pdfjs: { GlobalWorkerOptions: {} },
}));

const { mockScrollToIndex, mockGetVirtualItemForOffset, mockIsAtEnd, mockUseWindowVirtualizer } = vi.hoisted(() => ({
  mockScrollToIndex: vi.fn(),
  mockGetVirtualItemForOffset: vi.fn(() => ({ index: 0 })),
  mockIsAtEnd: vi.fn(() => false),
  mockUseWindowVirtualizer: vi.fn(),
}));

// happy-dom reports zero layout, so the real virtualizer would otherwise render no pages; this
// replaces it with a pass-through that renders every page, matching this suite's small page counts.
// Wrapped in a vi.fn (rather than inlined) so tests can inspect the options PdfReader passes it, e.g.
// scrollPaddingStart tracking the sticky header's height.
vi.mock('@tanstack/react-virtual', () => ({
  useWindowVirtualizer: (options: { count: number }) => {
    mockUseWindowVirtualizer(options);
    const { count } = options;
    return {
      getTotalSize: () => 0,
      getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ key: index, index, start: 0, size: 0 })),
      scrollToIndex: mockScrollToIndex,
      getVirtualItemForOffset: mockGetVirtualItemForOffset,
      isAtEnd: mockIsAtEnd,
      measure: () => {},
    };
  },
}));

const resizeObservers = new Set<MockResizeObserver>();

// Triggers every currently-observing MockResizeObserver watching `target` again, as if it had
// actually resized - `observe()` only fires once, synchronously, on mount.
const triggerResize = (target: Element, contentRect: { width: number; height: number }) => {
  for (const observer of resizeObservers) {
    if (observer.target === target) {
      observer.callback(
        [{ target, contentRect } as unknown as ResizeObserverEntry],
        observer as unknown as ResizeObserver,
      );
    }
  }
};

class MockResizeObserver {
  callback: ResizeObserverCallback;
  target?: Element;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObservers.add(this);
  }

  observe(target: Element) {
    this.target = target;
    this.callback(
      [{ target, contentRect: { width: 600, height: 0 } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  unobserve() {}
  disconnect() {
    resizeObservers.delete(this);
  }
}

describe('PdfReader', () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    resetMockPageViewports();
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    resizeObservers.clear();
    mockScrollToIndex.mockClear();
    mockGetVirtualItemForOffset.mockReset().mockReturnValue({ index: 0 });
    mockIsAtEnd.mockReset().mockReturnValue(false);
    mockUseWindowVirtualizer.mockClear();
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

  it('clamps an out-of-range typed page to the last page', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );

    renderReader(readingId, 5);
    await screen.findByText('Page 1');

    const input = screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockScrollToIndex).toHaveBeenCalledWith(4, { align: 'start' });
    expect(input.value).toBe('5');
  });

  it('shows an error message when the download fails', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () => HttpResponse.json(null, { status: 500 })),
    );

    renderReader(readingId, 5);

    await screen.findByText('Failed to load the PDF. Please try again.');
  });

  it("caps a page's render width at 125% of its own native size when that's smaller than the container", async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );
    // 300pt -> 400px at 96/72 -> 500px at 125% scale; container is mocked at 600px, so the native cap wins.
    mockPageViewports[0] = { width: 300, height: 400 };

    renderReader(readingId, 5);

    const page = await screen.findByText('Page 1');
    expect(page.dataset.width).toBe('500');
  });

  it('caps different pages independently, so a mixed-size document never stretches every page to the widest one', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );
    // Page 1: 300pt -> capped at 500px (125% of native). Page 2: 1000pt -> would be 1666px at 125%,
    // so it's capped by the 600px container width instead.
    mockPageViewports[0] = { width: 300, height: 400 };
    mockPageViewports[1] = { width: 1000, height: 1200 };

    renderReader(readingId, 5);

    const page1 = await screen.findByText('Page 1');
    expect(page1.dataset.width).toBe('500');
    expect(screen.getByText('Page 2').dataset.width).toBe('600');
  });

  it('updates the current page indicator on scroll, based on the virtualizer offset lookup', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );

    renderReader(readingId, 5);
    await screen.findByText('Page 1');

    mockGetVirtualItemForOffset.mockReturnValue({ index: 2 });
    fireEvent.scroll(window);

    expect((screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement).value).toBe('3');
  });

  it('jumps the indicator to the last page once the virtualizer reports scroll has reached the end', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );

    renderReader(readingId, 5);
    await screen.findByText('Page 1');

    // Simulates a short last page: the offset lookup would otherwise stay stuck one page early.
    mockGetVirtualItemForOffset.mockReturnValue({ index: 1 });
    mockIsAtEnd.mockReturnValue(true);
    fireEvent.scroll(window);

    expect((screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement).value).toBe('5');
  });

  it('jumps to the target page when an internal PDF link is clicked', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );

    renderReader(readingId, 5);
    await screen.findByText('Page 1');

    fireEvent.click(screen.getByText('fake internal link'));

    expect(mockScrollToIndex).toHaveBeenCalledWith(2, { align: 'start' });
  });

  it("recomputes the virtualizer's scroll padding when the sticky header resizes", async () => {
    const header = document.createElement('div');
    header.dataset.slot = 'header';
    document.body.appendChild(header);

    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );

    renderReader(readingId, 5);
    await screen.findByText('Page 1');

    triggerResize(header, { width: 800, height: 56 });

    await waitFor(() => {
      const lastCallOptions = mockUseWindowVirtualizer.mock.calls.at(-1)?.[0] as { scrollPaddingStart?: number };
      expect(lastCallOptions?.scrollPaddingStart).toBe(56);
    });

    header.remove();
  });

  it('shows the translation trigger when selecting text inside a rendered page', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );

    renderReader(readingId, 5);
    const pageText = await screen.findByText('Page 1');

    const textNode = pageText.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 4); // "Page"
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    document.dispatchEvent(new Event('pointerup'));

    expect(await screen.findByRole('button', { name: 'Translate selection' })).toBeTruthy();

    selection.removeAllRanges();
  });
});
