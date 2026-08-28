import { type FC, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSelection } from '@/hooks/use-selection';
import { useHideGoogleTranslateExtensionPopup } from '@/hooks/use-hide-google-translate-extension-popup';
import { correctRange, getContext } from '@/utils/selection';

type TranslationData = {
  rect: DOMRect;
  before: string | null;
  text: string;
  after: string | null;
};

// Long selections (a paragraph or more) aren't practical to translate in a popover, and matching the
// Google Translate extension's own behavior, the button simply doesn't appear rather than truncating.
// ~400 chars covers a single word up to several sentences while excluding full paragraphs.
const MAX_SELECTION_LENGTH = 400;

// getBoundingClientRect() unions every line the selection spans, so its right edge can sit far past
// where the selection actually ends (e.g. a longer first line in a multi-line selection). The last
// rect in DOM order is usually the selection's final line, but a PDF text layer's spans aren't
// always emitted in strict left-to-right order (kerned/stylized headings in particular), so instead
// this picks whichever rect is lowest on the page, tie-broken by the rightmost - the actual
// bottom-right corner of the selection, regardless of source order.
const getEndRect = (range: Range): DOMRect => {
  const rects = Array.from(range.getClientRects());

  return rects.reduce((end, rect) => {
    if (rect.bottom > end.bottom + 1) return rect;
    if (rect.bottom < end.bottom - 1) return end;
    return rect.right > end.right ? rect : end;
  }, rects[0] ?? range.getBoundingClientRect());
};

export const TranslationPopover: FC = () => {
  const [data, setData] = useState<TranslationData | null>(null);
  const [open, setOpen] = useState(false);

  useSelection((selection) => {
    const range = correctRange(selection.getRangeAt(0));
    const text = range.toString().trim();
    if (text.length > MAX_SELECTION_LENGTH) return;

    const { before, after } = getContext(range);

    setData({ rect: getEndRect(range), before, text, after });
    setOpen(false);
  });

  useHideGoogleTranslateExtensionPopup();

  // The button's position is captured once, at selection end, as viewport coordinates - it doesn't
  // track scroll. Rather than keep it glued to text that's since scrolled elsewhere, it's dismissed
  // on scroll. (Not dismissed on selectionchange: tapping the button itself collapses the browser
  // selection first, same as any other click/tap outside it - clearing on that would remove the
  // button from the DOM before its own click/tap had a chance to fire.)
  useEffect(() => {
    if (!data || open) return;

    const clear = () => setData(null);

    window.addEventListener('scroll', clear, { passive: true });
    return () => window.removeEventListener('scroll', clear);
  }, [data, open]);

  return (
    <>
      {data &&
        !open &&
        createPortal(
          <Button
            type="button"
            size="icon-sm"
            onClick={() => {
              window.getSelection()?.removeAllRanges();
              setOpen(true);
            }}
            // The outline variant relies on ambient text color and a near-white border, both fine
            // for buttons living in the app's own chrome - but this one floats over arbitrary PDF
            // page content (often white), so it needs its own explicit, high-contrast styling.
            className="fixed z-50 shadow-md hover:bg-primary"
            style={{ top: data.rect.bottom, left: data.rect.right, transform: 'translateX(-100%)' }}
          >
            <Languages />
            <span className="sr-only">Translate selection</span>
          </Button>,
          document.body,
        )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setData(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{data?.text}</DialogTitle>
            <DialogDescription>{[data?.before, data?.text, data?.after].filter(Boolean).join(' ')}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};
