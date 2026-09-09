import { type FC, useState } from 'react';
import { ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = {
  currentPage: number;
  totalPages: number;
  onGoToPage: (page: number) => void;
  disabled: boolean;
  zoomLevel: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export const PdfReaderToolbar: FC<Props> = ({
  currentPage,
  totalPages,
  onGoToPage,
  disabled,
  zoomLevel,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
}) => {
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
      <div className="relative container flex h-14 items-center justify-center gap-2">
        <div className="absolute left-4 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled || !canZoomOut}
            aria-label="Zoom out"
            onClick={onZoomOut}
          >
            <ZoomOutIcon />
          </Button>
          <span className="w-10 text-center text-sm text-muted-foreground tabular-nums">
            {Math.round(zoomLevel * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled || !canZoomIn}
            aria-label="Zoom in"
            onClick={onZoomIn}
          >
            <ZoomInIcon />
          </Button>
        </div>

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
          disabled={disabled}
          className="h-8 w-14 text-center tabular-nums"
          aria-label="Page number"
        />
        <span className="text-sm text-muted-foreground tabular-nums">/ {totalPages}</span>
      </div>
    </div>
  );
};
