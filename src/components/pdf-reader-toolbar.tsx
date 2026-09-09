import { type FC } from 'react';
import { ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNumberFieldInput } from '@/hooks/use-number-field-input';
import { MAX_ZOOM_PERCENT, MIN_ZOOM_PERCENT } from '@/hooks/use-pdf-zoom';

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
  onZoomChange: (percent: number) => void;
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
  onZoomChange,
}) => {
  // No step: zoom accepts any whole percent in range, not just increments of the +/- buttons' step.
  // Blank while disabled, instead of showing BASE_ZOOM until the persisted value loads in.
  const { inputRef: zoomInputRef, inputProps: zoomInputProps } = useNumberFieldInput({
    'aria-label': 'Zoom percentage',
    value: disabled ? NaN : Math.round(zoomLevel * 100),
    minValue: MIN_ZOOM_PERCENT,
    maxValue: MAX_ZOOM_PERCENT,
    // Fixes numeric formatOptions so inputMode resolves the same on the server and the client -
    // leaving it to locale inference caused an SSR/CSR inputMode mismatch (numeric vs decimal).
    formatOptions: { maximumFractionDigits: 0 },
    isDisabled: disabled,
    onChange: onZoomChange,
    // Otherwise the browser/OS infers "next" and Enter jumps focus to the page input.
    enterKeyHint: 'done',
  });

  const { inputRef: pageInputRef, inputProps: pageInputProps } = useNumberFieldInput({
    'aria-label': 'Page number',
    value: currentPage,
    minValue: 1,
    maxValue: totalPages,
    step: 1,
    formatOptions: { maximumFractionDigits: 0 },
    isDisabled: disabled,
    onChange: onGoToPage,
    enterKeyHint: 'done',
  });

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background">
      <div className="container flex h-14 flex-nowrap items-center gap-2 overflow-x-auto px-4">
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-6 md:size-8"
            disabled={disabled || !canZoomOut}
            aria-label="Zoom out"
            onClick={onZoomOut}
          >
            <ZoomOutIcon className="size-4" />
          </Button>
          <Input
            ref={zoomInputRef}
            {...zoomInputProps}
            className="h-6 w-12 shrink-0 appearance-none px-0.5 text-center text-sm tabular-nums"
          />
          <span className="text-sm text-muted-foreground tabular-nums">%</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-6 md:size-8"
            disabled={disabled || !canZoomIn}
            aria-label="Zoom in"
            onClick={onZoomIn}
          >
            <ZoomInIcon className="size-4" />
          </Button>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
          <Input
            ref={pageInputRef}
            {...pageInputProps}
            className="h-6 w-12 shrink-0 appearance-none px-0.5 text-center text-sm tabular-nums"
          />
          <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">/ {totalPages}</span>
        </div>

        <div className="invisible flex shrink-0 items-center gap-1" aria-hidden>
          <Button type="button" variant="ghost" size="icon-sm" className="size-6 md:size-8" tabIndex={-1}>
            <ZoomOutIcon className="size-4" />
          </Button>
          <div className="h-6 w-12" />
          <span className="text-sm">%</span>
          <Button type="button" variant="ghost" size="icon-sm" className="size-6 md:size-8" tabIndex={-1}>
            <ZoomInIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
