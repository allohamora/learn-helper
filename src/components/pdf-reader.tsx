import { type FC, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import { appClient } from '@/services/api';
import { Loader } from '@/components/ui/loader';
import { PdfReaderToolbar } from '@/components/pdf-reader-toolbar';
import { useSelection } from '@/hooks/use-selection';
import { getContext } from '@/utils/selection';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Must stay in this module (not a shared lib file): react-pdf requires workerSrc to be set in the
// same module that renders <Document>/<Page>, or module execution order can let a stale default win.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

type Props = {
  readingId: string;
  totalPages: number;
};

const OVERSCAN_PAGES = 2; // approximates the old 800px pixel buffer, biased generous for short/landscape pages
const PAGE_GAP_PX = 16;

export const PdfReader: FC<Props> = ({ readingId, totalPages }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const [headerHeight, setHeaderHeight] = useState(0);
  // The virtualized content's offset from the top of the document. Tanstack's window virtualizer
  // needs this explicitly (unlike virtua, which auto-detects it), to translate between document
  // scroll coordinates and item positions.
  const [scrollMargin, setScrollMargin] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);

  useSelection((selection) => {
    toast.success(selection.toString(), { description: getContext(selection) });
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

  const virtualizer = useWindowVirtualizer({
    count: sizes.length,
    estimateSize: (index) => containerWidth * (sizes[index].height / sizes[index].width),
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
    <div className="flex flex-col gap-4 pt-4 pb-20">
      <div ref={containerRef} className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
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
                      width={containerWidth}
                      renderTextLayer
                      renderAnnotationLayer
                      className="overflow-hidden rounded-lg border shadow-sm"
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

      <PdfReaderToolbar
        currentPage={currentPage}
        totalPages={totalPages}
        onGoToPage={(page) => goToPage(Math.min(totalPages, Math.max(1, page)))}
      />
    </div>
  );
};
