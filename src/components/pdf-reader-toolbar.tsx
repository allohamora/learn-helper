import { type FC, useState } from 'react';
import { Input } from '@/components/ui/input';

type Props = {
  currentPage: number;
  totalPages: number;
  onGoToPage: (page: number) => void;
};

export const PdfReaderToolbar: FC<Props> = ({ currentPage, totalPages, onGoToPage }) => {
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [syncedPage, setSyncedPage] = useState(currentPage);

  if (currentPage !== syncedPage) {
    setSyncedPage(currentPage);
    setPageInput(String(currentPage));
  }

  const submitPage = () => {
    if (pageInput === '') return;

    const page = Number(pageInput);
    if (!Number.isInteger(page)) {
      setPageInput(String(currentPage));
      return;
    }

    const normalizedPage = Math.min(totalPages, Math.max(1, page));
    setPageInput(String(normalizedPage));
    onGoToPage(normalizedPage);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background">
      <div className="container flex h-14 items-center justify-center gap-2">
        <Input
          value={pageInput}
          onChange={(event) => setPageInput(event.target.value)}
          onBlur={submitPage}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submitPage();
            }
          }}
          className="h-8 w-14 text-center tabular-nums"
          aria-label="Page number"
        />
        <span className="text-sm text-muted-foreground tabular-nums">/ {totalPages}</span>
      </div>
    </div>
  );
};
