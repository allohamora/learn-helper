import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Document, Page, pdfjs } from 'react-pdf';
import { appClient } from '@/services/api';
import { Loader } from '@/components/ui/loader';
import { PdfReaderToolbar } from '@/components/pdf-reader-toolbar';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Must stay in this module (not a shared lib file): react-pdf requires workerSrc to be set in the
// same module that renders <Document>/<Page>, or module execution order can let a stale default win.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

type Props = {
  readingId: string;
  totalPages: number;
};

// Only used for the brief window before `reading` exists; the reader isn't rendered until then, so
// this fallback is never actually visible - every real page has its exact ratio from pageAspectRatios.
const FALLBACK_PAGE_ASPECT_RATIO = 1.294;
const OVERSCAN_PAGES = 4;
const PAGE_GAP_PX = 16;

export const PdfReader: FC<Props> = ({ readingId, totalPages }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const [headerHeight, setHeaderHeight] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);

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
    // The sticky site header visually covers the top of the scroll area, so the page counted as
    // "current", and the page landed on after a jump, should sit just below it, not at y=0. A header
    // height change also shifts where the page list starts, so scrollMargin is recomputed alongside it.
    const header = document.querySelector<HTMLElement>('[data-slot="header"]');
    if (!header) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeaderHeight(entry.contentRect.height);
      setScrollMargin(containerRef.current?.offsetTop ?? 0);
    });
    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  const {
    data: reading,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['reading-download', readingId],
    queryFn: async () => {
      const res = await appClient.api.v1.users.me.readings[':readingId'].download.$get({ param: { readingId } });
      if (!res.ok) throw new Error('Failed to load reading');

      const buffer = await res.arrayBuffer();

      // getDocument() transfers its buffer to the pdf.js worker, which detaches it - parse a
      // throwaway copy for page-size metadata so the buffer returned below stays usable for the
      // actual render below. Real sizes are fetched up front (rather than measured as pages render)
      // so the virtualizer never has to guess-then-correct, which is what caused it to jump and
      // misalign scrollToIndex.
      const pdf = await pdfjs.getDocument({ data: buffer.slice(0) }).promise;
      const pageAspectRatios = await Promise.all(
        Array.from({ length: pdf.numPages }, async (_, index) => {
          const page = await pdf.getPage(index + 1);
          const viewport = page.getViewport({ scale: 1 });

          return viewport.height / viewport.width;
        }),
      );

      return { buffer, pageAspectRatios };
    },
  });

  // pdf.js detaches whatever buffer it's given, so <Document> must never receive the same one twice
  // (e.g. across a dev-mode StrictMode remount) - hand it a fresh slice, memoized per fetched reading.
  const file = useMemo(() => (reading ? { data: reading.buffer.slice(0) } : null), [reading]);

  const isReady = !isPending && !isError && !!reading && !!file && containerWidth > 0;

  const virtualizer = useWindowVirtualizer({
    count: totalPages,
    estimateSize: (index) => containerWidth * (reading?.pageAspectRatios[index] ?? FALLBACK_PAGE_ASPECT_RATIO),
    overscan: OVERSCAN_PAGES,
    gap: PAGE_GAP_PX,
    scrollMargin,
    scrollPaddingStart: headerHeight,
  });

  const goToPage = (page: number) => virtualizer.scrollToIndex(page - 1, { align: 'start' });

  // The current page is the last one whose top has scrolled up past the header line.
  const currentPageTarget = (virtualizer.scrollOffset ?? 0) - scrollMargin + headerHeight;
  const currentPage = virtualizer
    .getVirtualItems()
    .reduce((page, item) => (item.start <= currentPageTarget ? item.index + 1 : page), 1);

  return (
    <div className="flex flex-col gap-4 pt-4 pb-20">
      <div ref={containerRef} className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
        {isPending ? (
          <div className="flex items-center justify-center py-16">
            <Loader />
          </div>
        ) : isError ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Failed to load the PDF. Please try again.</p>
        ) : (
          isReady &&
          file && (
            <Document
              file={file}
              loading={null}
              error={null}
              className="contents"
              onItemClick={({ pageIndex }) => goToPage(pageIndex + 1)}
            >
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  width: '100%',
                  position: 'relative',
                  overflowAnchor: 'none',
                }}
              >
                {virtualizer.getVirtualItems().map((item) => (
                  <div
                    key={item.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${item.start - scrollMargin}px)`,
                    }}
                  >
                    <Page
                      pageNumber={item.index + 1}
                      width={containerWidth}
                      renderTextLayer
                      renderAnnotationLayer
                      className="overflow-hidden rounded-lg border shadow-sm"
                      loading={
                        <div className="flex items-center justify-center py-16">
                          <Loader />
                        </div>
                      }
                    />
                  </div>
                ))}
              </div>
            </Document>
          )
        )}
      </div>

      <PdfReaderToolbar
        currentPage={currentPage}
        totalPages={totalPages}
        onGoToPage={(page) => goToPage(Math.min(totalPages, Math.max(1, page)))}
      />
    </div>
  );
};
