import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  const BASE_NOW = 1_000_000;

  // PdfReader flushes reading state on unmount (see "leaving the reader" tests below), and every
  // test unmounts via cleanup() in afterEach - frozen at a constant by default, real wall-clock
  // time can't advance between a test's mount and that cleanup, so addDurationMs stays 0 and the
  // flush's own guard skips it, keeping tests that don't care about this feature free of a stray
  // PATCH. Tests that do care move the clock forward via dateNowSpy.mockReturnValue(...).
  let dateNowSpy: MockInstance<() => number>;

  beforeEach(() => {
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    resetMockPageViewports();
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(BASE_NOW);
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    resizeObservers.clear();
    mockScrollToIndex.mockClear();
    mockGetVirtualItemForOffset.mockReset().mockReturnValue({ index: 0 });
    mockIsAtEnd.mockReset().mockReturnValue(false);
    mockUseWindowVirtualizer.mockClear();
    cleanup();
    dateNowSpy.mockRestore();
  });

  const renderReader = (readingId: string, totalPages: number, initialPage = 1) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

    return render(
      <QueryClientProvider client={queryClient}>
        <PdfReader readingId={readingId} totalPages={totalPages} initialPage={initialPage} />
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

  it('resumes at the last read page on mount', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );

    renderReader(readingId, 5, 3);
    await screen.findByText('Page 1');

    expect(mockScrollToIndex).toHaveBeenCalledWith(2, { align: 'start' });
    // Shows the resumed page immediately, rather than starting at 1 and flashing to 3 once the
    // scroll triggered above lands.
    expect((screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement).value).toBe('3');
  });

  it('does not jump on mount when the reading was never opened before', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );

    renderReader(readingId, 5, 1);
    await screen.findByText('Page 1');

    expect(mockScrollToIndex).not.toHaveBeenCalled();
  });

  it('reports the current page and the real elapsed time on each heartbeat', async () => {
    const readingId = crypto.randomUUID();
    const onStateUpdate = vi.fn();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
      http.patch(`/api/v1/users/me/readings/${readingId}/state`, async ({ request }) => {
        onStateUpdate(await request.json());
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    // The 15-minute interval is set up during mount, so spying on setInterval and invoking the
    // captured callback directly (rather than actually waiting, or faking timers from before the
    // async mount/load completes) is the reliable way to simulate a tick.
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    try {
      renderReader(readingId, 5);
      await screen.findByText('Page 1');

      // Scrolling ahead before the heartbeat fires proves it reads the latest page via a ref, not
      // whatever the page was when the interval was first created.
      mockGetVirtualItemForOffset.mockReturnValue({ index: 2 });
      fireEvent.scroll(window);

      const call = setIntervalSpy.mock.calls.find(([, delay]) => delay === 15 * 60_000);
      const callback = call?.[0] as (() => void) | undefined;
      expect(callback).toBeTypeOf('function');

      dateNowSpy.mockReturnValue(BASE_NOW + 15 * 60_000);
      callback!();

      await waitFor(() =>
        expect(onStateUpdate).toHaveBeenCalledExactlyOnceWith({ currentPage: 3, addDurationMs: 15 * 60_000 }),
      );
    } finally {
      setIntervalSpy.mockRestore();
    }
  });

  it('flushes the reading state, with the real elapsed time, when the tab is hidden', async () => {
    const readingId = crypto.randomUUID();
    const onStateUpdate = vi.fn();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
      http.patch(`/api/v1/users/me/readings/${readingId}/state`, async ({ request }) => {
        onStateUpdate(await request.json());
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');

    try {
      renderReader(readingId, 5);
      await screen.findByText('Page 1');

      mockGetVirtualItemForOffset.mockReturnValue({ index: 2 });
      fireEvent.scroll(window);

      dateNowSpy.mockReturnValue(BASE_NOW + 42_000);
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      fireEvent(document, new Event('visibilitychange'));

      await waitFor(() =>
        expect(onStateUpdate).toHaveBeenCalledExactlyOnceWith({ currentPage: 3, addDurationMs: 42_000 }),
      );
    } finally {
      restoreVisibilityState(originalVisibilityState);
    }
  });

  it('excludes hidden-tab time from the next flush once the tab becomes visible again', async () => {
    const readingId = crypto.randomUUID();
    const onStateUpdate = vi.fn();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
      http.patch(`/api/v1/users/me/readings/${readingId}/state`, async ({ request }) => {
        onStateUpdate(await request.json());
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    try {
      renderReader(readingId, 5);
      await screen.findByText('Page 1');

      mockGetVirtualItemForOffset.mockReturnValue({ index: 2 });
      fireEvent.scroll(window);

      // First visible span: 10s, flushed (and reset) by the hidden transition, as today.
      dateNowSpy.mockReturnValue(BASE_NOW + 10_000);
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      fireEvent(document, new Event('visibilitychange'));

      await waitFor(() => expect(onStateUpdate).toHaveBeenNthCalledWith(1, { currentPage: 3, addDurationMs: 10_000 }));

      // A long stretch hidden - none of this should ever be reported.
      dateNowSpy.mockReturnValue(BASE_NOW + 5_000_000);
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      fireEvent(document, new Event('visibilitychange'));

      // Second visible span: 20s, reported by the next heartbeat.
      dateNowSpy.mockReturnValue(BASE_NOW + 5_020_000);
      const call = setIntervalSpy.mock.calls.find(([, delay]) => delay === 15 * 60_000);
      const callback = call?.[0] as (() => void) | undefined;
      expect(callback).toBeTypeOf('function');
      callback!();

      await waitFor(() => expect(onStateUpdate).toHaveBeenNthCalledWith(2, { currentPage: 3, addDurationMs: 20_000 }));
      expect(onStateUpdate).toHaveBeenCalledTimes(2);
    } finally {
      restoreVisibilityState(originalVisibilityState);
      setIntervalSpy.mockRestore();
    }
  });

  it('does not count time before the tab becomes visible, when mounted while hidden', async () => {
    const readingId = crypto.randomUUID();
    const onStateUpdate = vi.fn();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
      http.patch(`/api/v1/users/me/readings/${readingId}/state`, async ({ request }) => {
        onStateUpdate(await request.json());
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    try {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      renderReader(readingId, 5);
      await screen.findByText('Page 1');

      // A long stretch hidden from the very start - none of this should ever be reported.
      dateNowSpy.mockReturnValue(BASE_NOW + 1_000_000);
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      fireEvent(document, new Event('visibilitychange'));

      // Only this span, after becoming visible, counts.
      dateNowSpy.mockReturnValue(BASE_NOW + 1_008_000);
      const call = setIntervalSpy.mock.calls.find(([, delay]) => delay === 15 * 60_000);
      const callback = call?.[0] as (() => void) | undefined;
      expect(callback).toBeTypeOf('function');
      callback!();

      await waitFor(() =>
        expect(onStateUpdate).toHaveBeenCalledExactlyOnceWith({ currentPage: 1, addDurationMs: 8_000 }),
      );
    } finally {
      restoreVisibilityState(originalVisibilityState);
      setIntervalSpy.mockRestore();
    }
  });

  it('sends nothing on a heartbeat that fires while the tab is currently hidden', async () => {
    const readingId = crypto.randomUUID();
    const onStateUpdate = vi.fn();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
      http.patch(`/api/v1/users/me/readings/${readingId}/state`, async ({ request }) => {
        onStateUpdate(await request.json());
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    try {
      renderReader(readingId, 5);
      await screen.findByText('Page 1');

      // Goes hidden right at mount - nothing accumulated yet, so this flush is skipped.
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      fireEvent(document, new Event('visibilitychange'));

      // 20 minutes pass while still hidden, then the heartbeat fires.
      dateNowSpy.mockReturnValue(BASE_NOW + 20 * 60_000);
      const call = setIntervalSpy.mock.calls.find(([, delay]) => delay === 15 * 60_000);
      const callback = call?.[0] as (() => void) | undefined;
      expect(callback).toBeTypeOf('function');
      callback!();

      // Give any stray PATCH a chance to land before asserting it never did.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onStateUpdate).not.toHaveBeenCalled();
    } finally {
      restoreVisibilityState(originalVisibilityState);
      setIntervalSpy.mockRestore();
    }
  });

  it('flushes the reading state when the page is hidden via pagehide', async () => {
    const readingId = crypto.randomUUID();
    const onStateUpdate = vi.fn();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
      http.patch(`/api/v1/users/me/readings/${readingId}/state`, async ({ request }) => {
        onStateUpdate(await request.json());
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    renderReader(readingId, 5);
    await screen.findByText('Page 1');

    mockGetVirtualItemForOffset.mockReturnValue({ index: 1 });
    fireEvent.scroll(window);

    dateNowSpy.mockReturnValue(BASE_NOW + 17_000);
    fireEvent(window, new Event('pagehide'));

    await waitFor(() =>
      expect(onStateUpdate).toHaveBeenCalledExactlyOnceWith({ currentPage: 2, addDurationMs: 17_000 }),
    );
  });

  it('flushes the reading state on unmount, so in-app navigation away is not lost', async () => {
    const readingId = crypto.randomUUID();
    const onStateUpdate = vi.fn();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
      http.patch(`/api/v1/users/me/readings/${readingId}/state`, async ({ request }) => {
        onStateUpdate(await request.json());
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const { unmount } = renderReader(readingId, 5);
    await screen.findByText('Page 1');

    mockGetVirtualItemForOffset.mockReturnValue({ index: 3 });
    fireEvent.scroll(window);

    dateNowSpy.mockReturnValue(BASE_NOW + 5_000);
    unmount();

    await waitFor(() =>
      expect(onStateUpdate).toHaveBeenCalledExactlyOnceWith({ currentPage: 4, addDurationMs: 5_000 }),
    );
  });

  it('does not double-flush when visibilitychange and pagehide both fire for the same tab close', async () => {
    const readingId = crypto.randomUUID();
    const onStateUpdate = vi.fn();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
      http.patch(`/api/v1/users/me/readings/${readingId}/state`, async ({ request }) => {
        onStateUpdate(await request.json());
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');

    try {
      renderReader(readingId, 5);
      await screen.findByText('Page 1');

      mockGetVirtualItemForOffset.mockReturnValue({ index: 2 });
      fireEvent.scroll(window);

      dateNowSpy.mockReturnValue(BASE_NOW + 42_000);
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      // Chrome fires both events, in this order, for an actual tab close - pagehide must not report
      // the same elapsed time a second time.
      fireEvent(document, new Event('visibilitychange'));
      fireEvent(window, new Event('pagehide'));

      await waitFor(() =>
        expect(onStateUpdate).toHaveBeenCalledExactlyOnceWith({ currentPage: 3, addDurationMs: 42_000 }),
      );
    } finally {
      restoreVisibilityState(originalVisibilityState);
    }
  });

  it('does not flush again on unmount once an exit event already flushed', async () => {
    const readingId = crypto.randomUUID();
    const onStateUpdate = vi.fn();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
      http.patch(`/api/v1/users/me/readings/${readingId}/state`, async ({ request }) => {
        onStateUpdate(await request.json());
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const { unmount } = renderReader(readingId, 5);
    await screen.findByText('Page 1');

    mockGetVirtualItemForOffset.mockReturnValue({ index: 1 });
    fireEvent.scroll(window);

    dateNowSpy.mockReturnValue(BASE_NOW + 17_000);
    fireEvent(window, new Event('pagehide'));

    await waitFor(() =>
      expect(onStateUpdate).toHaveBeenCalledExactlyOnceWith({ currentPage: 2, addDurationMs: 17_000 }),
    );

    // The cleanup effect's own unconditional flushOnExit call, run right after pagehide's, must be
    // skipped by the same guard - not send a second, ~0ms PATCH for the same close.
    unmount();
    // Give any stray PATCH a chance to land before asserting it never did.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onStateUpdate).toHaveBeenCalledOnce();
  });

  it('registers the exit-flush listeners exactly once, not again on every re-render', async () => {
    const readingId = crypto.randomUUID();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
    );

    const documentAddSpy = vi.spyOn(document, 'addEventListener');
    const windowAddSpy = vi.spyOn(window, 'addEventListener');

    try {
      renderReader(readingId, 5);
      await screen.findByText('Page 1');

      // Several state updates (scroll-driven re-renders) after mount should never re-subscribe.
      mockGetVirtualItemForOffset.mockReturnValue({ index: 1 });
      fireEvent.scroll(window);
      mockGetVirtualItemForOffset.mockReturnValue({ index: 3 });
      fireEvent.scroll(window);

      // Two independent subscribers, each registered once: the component's own exit-flush effect,
      // and useVisibleDuration's own visible/hidden accounting effect.
      expect(documentAddSpy.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(2);
      expect(windowAddSpy.mock.calls.filter(([type]) => type === 'pagehide')).toHaveLength(1);
    } finally {
      documentAddSpy.mockRestore();
      windowAddSpy.mockRestore();
    }
  });

  it('keeps the accumulated duration for the next flush after a heartbeat PATCH fails', async () => {
    const readingId = crypto.randomUUID();
    const onStateUpdate = vi.fn();
    let attempt = 0;
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
      http.patch(`/api/v1/users/me/readings/${readingId}/state`, async ({ request }) => {
        attempt += 1;
        const json = await request.json();
        if (attempt === 1) return HttpResponse.json({ success: false, error: { messages: ['boom'] } }, { status: 500 });

        onStateUpdate(json);
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      renderReader(readingId, 5);
      await screen.findByText('Page 1');

      const call = setIntervalSpy.mock.calls.find(([, delay]) => delay === 15 * 60_000);
      const callback = call?.[0] as (() => void) | undefined;
      expect(callback).toBeTypeOf('function');

      // First heartbeat: 5 minutes elapsed, the PATCH fails.
      dateNowSpy.mockReturnValue(BASE_NOW + 5 * 60_000);
      callback!();
      await waitFor(() => expect(attempt).toBe(1));
      await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledOnce());

      // Second heartbeat, 15 minutes later: if the failed attempt's 5 minutes had been discarded
      // (the old takeElapsedMs behavior), this would report only 15 * 60_000.
      dateNowSpy.mockReturnValue(BASE_NOW + 20 * 60_000);
      callback!();

      await waitFor(() =>
        expect(onStateUpdate).toHaveBeenCalledExactlyOnceWith({ currentPage: 1, addDurationMs: 20 * 60_000 }),
      );
      expect(attempt).toBe(2);
    } finally {
      setIntervalSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  it('never sends two flushes at once - a hidden-tab flush during an in-flight heartbeat is skipped, not raced', async () => {
    const readingId = crypto.randomUUID();
    const patchedBodies: unknown[] = [];
    let resolveFirst: (() => void) | undefined;
    const firstHeld = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
      http.patch(`/api/v1/users/me/readings/${readingId}/state`, async ({ request }) => {
        const json = await request.json();
        patchedBodies.push(json);
        // Holds the first response open to simulate a slow request still in flight; a real second
        // request landing here (rather than being skipped) would prove the race isn't guarded.
        if (patchedBodies.length === 1) await firstHeld;
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    try {
      renderReader(readingId, 5);
      await screen.findByText('Page 1');

      const call = setIntervalSpy.mock.calls.find(([, delay]) => delay === 15 * 60_000);
      const callback = call?.[0] as (() => void) | undefined;
      expect(callback).toBeTypeOf('function');

      // Heartbeat fires at +5min; its PATCH is held open, still in flight.
      dateNowSpy.mockReturnValue(BASE_NOW + 5 * 60_000);
      callback!();
      await waitFor(() => expect(patchedBodies).toHaveLength(1));

      // Tab is hidden 2 minutes later, while the heartbeat's PATCH is still in flight - must be
      // skipped, not sent as a second, concurrent request that could land out of order.
      dateNowSpy.mockReturnValue(BASE_NOW + 7 * 60_000);
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      fireEvent(document, new Event('visibilitychange'));

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(patchedBodies).toHaveLength(1);

      // Once the in-flight heartbeat resolves, the guard clears and the skipped time (never lost -
      // it kept accumulating) rides along on the next flush.
      resolveFirst!();
      await waitFor(() => expect(patchedBodies).toHaveLength(1));

      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      fireEvent(document, new Event('visibilitychange'));

      dateNowSpy.mockReturnValue(BASE_NOW + 20 * 60_000);
      callback!();

      await waitFor(() =>
        expect(patchedBodies).toEqual([
          { currentPage: 1, addDurationMs: 5 * 60_000 },
          { currentPage: 1, addDurationMs: 15 * 60_000 },
        ]),
      );
    } finally {
      restoreVisibilityState(originalVisibilityState);
      setIntervalSpy.mockRestore();
    }
  });

  it('does not save on scrolling or document (re)loading alone - only the heartbeat or an actual exit', async () => {
    const readingId = crypto.randomUUID();
    const onStateUpdate = vi.fn();
    mockServer.addHandlers(
      http.get(`/api/v1/users/me/readings/${readingId}/download`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.4').buffer),
      ),
      http.patch(`/api/v1/users/me/readings/${readingId}/state`, async ({ request }) => {
        onStateUpdate(await request.json());
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    renderReader(readingId, 5);
    await screen.findByText('Page 1');

    mockGetVirtualItemForOffset.mockReturnValue({ index: 1 });
    fireEvent.scroll(window);
    mockGetVirtualItemForOffset.mockReturnValue({ index: 3 });
    fireEvent.scroll(window);

    // Give any stray PATCH a chance to land before asserting it never did.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onStateUpdate).not.toHaveBeenCalled();
  });
});
