import { type FC, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

export const PdfReader: FC<Props> = ({ readingId, totalPages }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const [headerHeight, setHeaderHeight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const getPageElement = (page: number) =>
    containerRef.current?.querySelector<HTMLDivElement>(`[data-page-number="${page}"]`);

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
    // "current" should be the one visible just below it, not whichever one touches y=0.
    const header = document.querySelector<HTMLElement>('[data-slot="header"]');
    if (!header) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeaderHeight(entry.contentRect.height);
    });
    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  const { data, isPending, isError } = useQuery({
    queryKey: ['reading-download', readingId],
    queryFn: async () => {
      const res = await appClient.api.v1.users.me.readings[':readingId'].download.$get({ param: { readingId } });
      if (!res.ok) throw new Error('Failed to load reading');

      return { data: await res.arrayBuffer() };
    },
  });

  const isLoading = isPending;
  const isReady = !isLoading && !isError && !!data && containerWidth > 0;

  useEffect(() => {
    if (!isReady) return;

    // The current page is the last one whose top edge has scrolled up past the header line.
    const updateCurrentPage = () => {
      let page = 1;

      for (let candidate = 1; candidate <= totalPages; candidate++) {
        const element = getPageElement(candidate);
        if (!element || element.getBoundingClientRect().top > headerHeight) break;

        page = candidate;
      }

      setCurrentPage(page);
    };

    updateCurrentPage();

    let scheduled = false;
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        updateCurrentPage();
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, [isReady, totalPages, headerHeight]);

  return (
    <div className="flex flex-col gap-4 pt-4 pb-20">
      <div ref={containerRef} className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader />
          </div>
        ) : isError ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Failed to load the PDF. Please try again.</p>
        ) : (
          isReady &&
          data && (
            <Document
              file={data}
              loading={null}
              error={null}
              className="contents"
              onItemClick={({ pageIndex }) => getPageElement(pageIndex + 1)?.scrollIntoView({ block: 'start' })}
            >
              {Array.from({ length: totalPages }, (_, index) => {
                const page = index + 1;

                return (
                  <div key={page} data-page-number={page} style={{ scrollMarginTop: headerHeight }}>
                    <Page
                      pageNumber={page}
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
                );
              })}
            </Document>
          )
        )}
      </div>

      <PdfReaderToolbar
        currentPage={currentPage}
        totalPages={totalPages}
        onGoToPage={(page) =>
          getPageElement(Math.min(totalPages, Math.max(1, page)))?.scrollIntoView({ block: 'start' })
        }
      />
    </div>
  );
};
