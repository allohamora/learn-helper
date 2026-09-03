import { type FC, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useMutation } from '@tanstack/react-query';
import { useInterval } from 'react-use';
import { apiRequest, appClient } from '@/services/api';
import { Loader } from '@/components/ui/loader';
import { PdfReaderToolbar } from '@/components/pdf-reader-toolbar';
import { TranslationPopover } from '@/components/translation-popover';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Must stay in this module (not a shared lib file): react-pdf requires workerSrc to be set in the
// same module that renders <Document>/<Page>, or module execution order can let a stale default win.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

type Props = {
  readingId: string;
  totalPages: number;
  initialPage: number;
};

const OVERSCAN_PAGES = 2; // approximates the old 800px pixel buffer, biased generous for short/landscape pages
const PAGE_GAP_PX = 8;
const PDF_POINTS_TO_CSS_PX = 96 / 72;
// Mirrors pdf.js's own "Automatic Zoom": never render a page above 125% of its native size, so pages
// stop growing past a natural reading width on wide screens instead of stretching to fill them.
const MAX_AUTO_SCALE = 1.25;

const TIME_SPENT_FLUSH_INTERVAL_MS = 5 * 60_000;

export const PdfReader: FC<Props> = ({ readingId, totalPages, initialPage }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const [headerHeight, setHeaderHeight] = useState(0);
  // The virtualized content's offset from the top of the document. Tanstack's window virtualizer
  // needs this explicitly (unlike virtua, which auto-detects it), to translate between document
  // scroll coordinates and item positions.
  const [scrollMargin, setScrollMargin] = useState(0);

  // Seeded from initialPage (guarded against the reading's default of 0, "never opened") so the
  // toolbar shows the resumed page immediately, instead of flashing "Page 1" until the scroll
  // triggered by the resume effect below lands.
  const [currentPage, setCurrentPage] = useState(initialPage > 1 ? initialPage : 1);
  const hasResumedRef = useRef(false);

  const { mutate: updateReadingState } = useMutation({
    mutationFn: ({ currentPage, addDurationMs }: { currentPage: number; addDurationMs: number }) =>
      apiRequest(
        () =>
          appClient.api.v1.users.me.readings[':readingId'].state.$patch({
            param: { readingId },
            json: { currentPage, addDurationMs },
          }),
        'Failed to update reading state',
      ),
  });

  // Each page can have its own native size (e.g. a cover page sized differently from the rest), so
  // every page's real dimensions are fetched up front via onLoadSuccess rather than assumed from one
  // sample. getPage() only reads already-parsed page metadata, no rendering involved, so it's cheap.
  const [pageSizes, setPageSizes] = useState<{ width: number; height: number }[] | null>(null);

  const onDocumentLoadSuccess = async (pdf: PDFDocumentProxy) => {
    const dimensions = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, index) => {
        const page = await pdf.getPage(index + 1);
        const { width, height } = page.getViewport({ scale: 1 });
        return { width, height };
      }),
    );

    setPageSizes(dimensions);
  };

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // The sticky header occupies real layout space above the page list (position: sticky, not
    // fixed), so its height affects both where pages should land once scrolled below it
    // (headerHeight) and where the page list itself starts in the document (scrollMargin) - both
    // are recomputed together whenever the header resizes.
    const header = document.querySelector<HTMLElement>('[data-slot="header"]');
    if (!header) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeaderHeight(entry.contentRect.height);
      setScrollMargin(containerRef.current?.offsetTop ?? 0);
    });
    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  const downloadUrl = appClient.api.v1.users.me.readings[':readingId'].download.$path({ param: { readingId } });

  // Real page dimensions are known upfront (via pageSizes), so estimateSize is exact, not a guess.
  // Sized from sizes.length rather than pageSizes so estimateSize is never called before load / out
  // of bounds.
  const sizes = pageSizes ?? [];

  // Caps each page independently at 125% of its own native size (rather than the shared container's
  // width), so a document with mixed page sizes (e.g. a cover page scanned smaller than the rest)
  // doesn't stretch every page to match whichever one happens to be widest.
  const getPageWidth = (index: number) =>
    Math.min(containerWidth, sizes[index].width * PDF_POINTS_TO_CSS_PX * MAX_AUTO_SCALE);

  const virtualizer = useWindowVirtualizer({
    count: sizes.length,
    estimateSize: (index) => getPageWidth(index) * (sizes[index].height / sizes[index].width),
    gap: PAGE_GAP_PX,
    paddingEnd: PAGE_GAP_PX,
    overscan: OVERSCAN_PAGES,
    scrollMargin,
    scrollPaddingStart: headerHeight,
  });

  // estimateSize isn't part of the virtualizer's internal cache-invalidation deps, so a
  // containerWidth change (resize) alone won't trigger remeasurement — force it explicitly.
  useEffect(() => virtualizer.measure(), [containerWidth, virtualizer]);

  const goToPage = (page: number) => virtualizer.scrollToIndex(page - 1, { align: 'start' });

  // Resumes reading where the user last left off, once the document has loaded and the
  // virtualizer knows about every page. Guarded to fire only once per mount, so it doesn't
  // fight the user's own scrolling afterward.
  useEffect(() => {
    if (!pageSizes || hasResumedRef.current) return;
    hasResumedRef.current = true;

    if (initialPage > 1) goToPage(initialPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSizes]);

  // A single heartbeat, every 5 minutes, reports both the latest page and the duration since the
  // last heartbeat - one call that both bookmarks progress and records reading-time-spent, rather
  // than separate save-on-scroll and time-tracking mechanisms. useInterval (unlike a hand-rolled
  // setInterval) keeps its callback fresh across renders on its own, so this reads currentPage
  // directly without needing a ref to dodge a stale closure.
  useInterval(() => {
    updateReadingState({ currentPage, addDurationMs: TIME_SPENT_FLUSH_INTERVAL_MS });
  }, TIME_SPENT_FLUSH_INTERVAL_MS);

  useEffect(() => {
    const onScroll = () => {
      // A short last page can mean the browser's max scroll offset never actually pushes
      // scrollOffset + headerHeight past its start, so the offset lookup below would get stuck on
      // the second-to-last page — isAtEnd() checks the real scrollHeight instead and catches it.
      if (pageSizes && virtualizer.isAtEnd()) {
        setCurrentPage(totalPages);
        return;
      }

      const item = virtualizer.getVirtualItemForOffset(window.scrollY + headerHeight);
      if (item) setCurrentPage(item.index + 1);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [virtualizer, headerHeight, pageSizes, totalPages]);

  return (
    // -mx-4 cancels the shared layout's `.container` side padding, so pages render full-width on
    // mobile (matching mozilla's own pdf.js viewer) rather than losing ~32px of width, and thus text
    // size, to a gutter around a "card" that doesn't earn its keep on a small screen.
    <div className="-mx-4 flex flex-col gap-4 pt-4 pb-20 md:mx-0">
      <TranslationPopover readingId={readingId} />

      <div ref={containerRef} className="mx-auto flex w-full flex-col items-center gap-4">
        {containerWidth > 0 ? (
          <Document
            file={downloadUrl}
            loading={
              <div className="flex items-center justify-center py-16">
                <Loader />
              </div>
            }
            error={
              <p className="py-16 text-center text-sm text-muted-foreground">
                Failed to load the PDF. Please try again.
              </p>
            }
            className="contents"
            onLoadSuccess={(pdf) => void onDocumentLoadSuccess(pdf)}
            onItemClick={({ pageIndex }) => goToPage(pageIndex + 1)}
          >
            {pageSizes ? (
              <div style={{ position: 'relative', width: '100%', height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((item) => (
                  <div
                    key={item.key}
                    data-index={item.index}
                    className="absolute top-0 left-0 flex w-full items-center justify-center"
                    style={{
                      height: item.size,
                      transform: `translateY(${item.start - scrollMargin}px)`,
                      willChange: 'transform',
                    }}
                  >
                    <Page
                      pageNumber={item.index + 1}
                      width={getPageWidth(item.index)}
                      renderTextLayer
                      renderAnnotationLayer
                      className="overflow-hidden md:shadow-sm"
                      loading={<Loader />}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-16">
                <Loader />
              </div>
            )}
          </Document>
        ) : (
          <div className="flex items-center justify-center py-16">
            <Loader />
          </div>
        )}
      </div>

      <PdfReaderToolbar currentPage={currentPage} totalPages={totalPages} onGoToPage={goToPage} />
    </div>
  );
};
