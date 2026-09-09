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
  const { inputRef: zoomInputRef, inputProps: zoomInputProps } = useNumberFieldInput({
    'aria-label': 'Zoom percentage',
    value: Math.round(zoomLevel * 100),
    minValue: MIN_ZOOM_PERCENT,
    maxValue: MAX_ZOOM_PERCENT,
    isDisabled: disabled,
    onChange: onZoomChange,
  });

  const { inputRef: pageInputRef, inputProps: pageInputProps } = useNumberFieldInput({
    'aria-label': 'Page number',
    value: currentPage,
    minValue: 1,
    maxValue: totalPages,
    step: 1,
    isDisabled: disabled,
    onChange: onGoToPage,
  });

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
          <Input ref={zoomInputRef} {...zoomInputProps} className="h-8 w-14 text-center tabular-nums" />
          <span className="text-sm text-muted-foreground tabular-nums">%</span>
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

        <Input ref={pageInputRef} {...pageInputProps} className="h-8 w-14 text-center tabular-nums" />
        <span className="text-sm text-muted-foreground tabular-nums">/ {totalPages}</span>
      </div>
    </div>
  );
};
