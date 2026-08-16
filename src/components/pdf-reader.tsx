import { type FC, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
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
            onItemClick={({ pageIndex }) => goToPage(pageIndex + 1)}
          >
            <WindowVirtualizer
              ref={virtualizerRef}
              data={Array.from({ length: totalPages })}
              bufferSize={BUFFER_SIZE_PX}
              onScroll={updateCurrentPage}
            >
              {(_, index) => (
                <div key={index} className="flex items-center justify-center" style={{ paddingBottom: PAGE_GAP_PX }}>
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
