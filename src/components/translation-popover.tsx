import { type FC, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSelection } from '@/hooks/use-selection';
import { useHideGoogleTranslateExtensionPopup } from '@/hooks/use-hide-google-translate-extension-popup';
import { correctRange, getContext } from '@/utils/selection';

type TranslationData = {
  rect: DOMRect;
  lineHeight: number;
  before: string | null;
  text: string;
  after: string | null;
};

// Long selections (a paragraph or more) aren't practical to translate in a popover, and matching the
// Google Translate extension's own behavior, the button simply doesn't appear rather than truncating.
// ~400 chars covers a single word up to several sentences while excluding full paragraphs.
const MAX_SELECTION_LENGTH = 400;

// Android/iOS commonly render their own copy/paste toolbar directly above a selection, and always
// place a draggable handle at its bottom-right corner - a button placed at either spot competes with
// native UI for taps and generally loses. Hypothesis's client (a mature open-source annotator that
// solves this same problem across browsers - see its `adder.tsx`) defaults to placing its toolbar
// below the selection for this reason, falling back to above only when there isn't room below. This
// mirrors that.
const GAP_PX = 8;
const BUTTON_SIZE_PX = 32; // matches the `icon-sm` Button size (`size-8`)

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

const getButtonPosition = (rect: DOMRect, lineHeight: number): { top: number; left: number } => {
  // On touch, a fixed pixel gap risks landing mid-way through the very next line of text (a gap that
  // happens to approximate one line height looks like it's floating on top of unrelated content,
  // rather than below the selection) - clearing a full line height first guarantees it sits in the
  // gap after that line instead. Desktop has no native handle to dodge, so it just sits close below.
  const gap = isTouchDevice() ? lineHeight + GAP_PX : GAP_PX;
  const fitsBelow = rect.bottom + gap + BUTTON_SIZE_PX <= window.innerHeight;
  const top = fitsBelow ? rect.bottom + gap : rect.top - gap - BUTTON_SIZE_PX;

  const left = Math.min(
    Math.max(rect.left + rect.width / 2, BUTTON_SIZE_PX / 2),
    window.innerWidth - BUTTON_SIZE_PX / 2,
  );

  return { top: Math.min(Math.max(top, 0), window.innerHeight - BUTTON_SIZE_PX), left };
};

export const TranslationPopover: FC = () => {
  const [data, setData] = useState<TranslationData | null>(null);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useSelection((selection) => {
    const range = correctRange(selection.getRangeAt(0));
    const text = range.toString().trim();
    if (text.length > MAX_SELECTION_LENGTH) return;

    const { before, after } = getContext(range);
    const rect = range.getBoundingClientRect();
    // getClientRects() has one rect per line the selection spans - the first one's height is the
    // actual line height of the selected text, unlike `rect.height` which sums every line spanned.
    const lineHeight = range.getClientRects()[0]?.height ?? rect.height;

    setData({ rect, lineHeight, before, text, after });
    setOpen(false);
  });

  useHideGoogleTranslateExtensionPopup();

  // The button's position is captured once, as viewport coordinates - it doesn't track scroll.
  // Rather than keep it glued to text that's since scrolled elsewhere, it's dismissed on scroll.
  //
  // It's also dismissed on any pointerdown outside itself, so clicking/tapping elsewhere on the page
  // - which collapses the current selection - closes the stale button instead of leaving it stuck.
  // This has to be pointerdown-outside rather than "selection collapsed": tapping the button itself
  // also collapses the browser selection (same as any other click), and clearing on that would remove
  // the button from the DOM before its own click/tap had a chance to fire.
  useEffect(() => {
    if (!data || open) return;

    const clear = () => setData(null);
    const clearIfOutside = (event: PointerEvent) => {
      if (!buttonRef.current?.contains(event.target as Node)) clear();
    };

    window.addEventListener('scroll', clear, { passive: true });
    document.addEventListener('pointerdown', clearIfOutside);

    return () => {
      window.removeEventListener('scroll', clear);
      document.removeEventListener('pointerdown', clearIfOutside);
    };
  }, [data, open]);

  return (
    <>
      {data &&
        !open &&
        createPortal(
          <Button
            ref={buttonRef}
            type="button"
            size="icon-sm"
            onClick={() => {
              window.getSelection()?.removeAllRanges();
              // Clearing the selection starts an animated OS transition on mobile (the native
              // copy/paste toolbar fading out) that isn't instant even though this call returns
              // immediately - opening the dialog in the same tick shows both at once, mid-transition,
              // stacked on top of each other. One frame's delay lets that transition actually finish
              // first. Hypothesis's client (see its `guest.ts`) sidesteps this the same way: it clears
              // the selection and lets its own toolbar disappear reactively, later, rather than
              // forcing both transitions into the same instant.
              requestAnimationFrame(() => setOpen(true));
            }}
            // The outline variant relies on ambient text color and a near-white border, both fine
            // for buttons living in the app's own chrome - but this one floats over arbitrary PDF
            // page content (often white), so it needs its own explicit, high-contrast styling.
            className="fixed z-50 shadow-md hover:bg-primary"
            style={{ ...getButtonPosition(data.rect, data.lineHeight), transform: 'translateX(-50%)' }}
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
            <DialogDescription>
              {JSON.stringify({ before: data?.before, text: data?.text, after: data?.after }, null, 2)}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};
