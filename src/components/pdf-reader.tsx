import { type FC, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { WindowVirtualizer, type WindowVirtualizerHandle } from 'virtua';
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

const BUFFER_SIZE_PX = 800;
const PAGE_GAP_PX = 16;

export const PdfReader: FC<Props> = ({ readingId, totalPages }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const [headerHeight, setHeaderHeight] = useState(0);

  const virtualizerRef = useRef<WindowVirtualizerHandle>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Each page can have its own native size (e.g. a cover page sized differently from the rest), so
  // every page's real dimensions are fetched up front via onLoadSuccess rather than assumed from one
  // sample. getPage() only reads already-parsed page metadata, no rendering involved, so it's cheap.
  // Virtua estimates unmeasured item heights from already-measured ones; without this, every page
  // starts at the tiny loading-spinner height and jumps to its real height once rendered, which
  // throws off virtua's size cache and makes scrollbar dragging jump around.
  const [pageSizes, setPageSizes] = useState<{ width: number; height: number }[] | null>(null);

  const onDocumentLoadSuccess = async (pdf: PDFDocumentProxy) => {
    const sizes = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, index) => {
        const page = await pdf.getPage(index + 1);
        const { width, height } = page.getViewport({ scale: 1 });
        return { width, height };
      }),
    );

    setPageSizes(sizes);
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
    // The sticky site header visually covers the top of the scroll area, so the page counted as
    // "current", and the page landed on after a jump, should sit just below it, not at y=0.
    const header = document.querySelector<HTMLElement>('[data-slot="header"]');
    if (!header) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeaderHeight(entry.contentRect.height);
    });
    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  const downloadUrl = appClient.api.v1.users.me.readings[':readingId'].download.$path({ param: { readingId } });

  const goToPage = (page: number) =>
    virtualizerRef.current?.scrollToIndex(page - 1, { align: 'start', offset: -headerHeight });

  const updateCurrentPage = () => {
    const handle = virtualizerRef.current;
    if (!handle) return;

    setCurrentPage(handle.findItemIndex(handle.scrollOffset + headerHeight) + 1);
  };

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
              <WindowVirtualizer
                ref={virtualizerRef}
                data={pageSizes}
                bufferSize={BUFFER_SIZE_PX}
                onScroll={updateCurrentPage}
              >
                {({ width, height }, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-center"
                    style={{ height: containerWidth * (height / width) + PAGE_GAP_PX, paddingBottom: PAGE_GAP_PX }}
                  >
                    <Page
                      pageNumber={index + 1}
                      width={containerWidth}
                      renderTextLayer
                      renderAnnotationLayer
                      className="overflow-hidden rounded-lg border shadow-sm"
                      loading={<Loader />}
                    />
                  </div>
                )}
              </WindowVirtualizer>
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
