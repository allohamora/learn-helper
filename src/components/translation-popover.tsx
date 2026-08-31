import { type FC, useState } from 'react';
import { FloatingPortal } from '@floating-ui/react';
import { Languages, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSelection } from '@/hooks/use-selection';
import { useSelectionFloating } from '@/hooks/use-selection-floating';
import { useHideGoogleTranslateExtensionPopup } from '@/hooks/use-hide-google-translate-extension-popup';
import { correctRange, getContext } from '@/utils/selection';

type TranslationData = {
  // The exact selection the user made - not correctRange()'s word-expanded version of it, which only
  // ever exists as a local value used to derive `text`/`before`/`after` below. Everything that needs
  // to reflect what's actually selected on screen uses this instead: anchoring the trigger/panel
  // position, telling one selection apart from another, and restoring the selection (see Popover's
  // trigger onClick) so a native Copy still copies exactly what was selected.
  range: Range;
  before: string | null;
  text: string;
  after: string | null;
};

// Long selections (a paragraph or more) aren't practical to translate in a popover, and matching the
// Google Translate extension's own behavior, the button simply doesn't appear rather than truncating.
// ~400 chars covers a single word up to several sentences while excluding full paragraphs.
const MAX_SELECTION_LENGTH = 400;

const GAP_PX = 8;

type PanelProps = {
  data: TranslationData | null;
  onClear: () => void;
};

// Range has no equals() - two Ranges over the same text are compared by their actual boundary
// points, not by string content (two different occurrences of the same word must count as different).
const isSameRange = (a: Range, b: Range) =>
  a.startContainer === b.startContainer &&
  a.startOffset === b.startOffset &&
  a.endContainer === b.endContainer &&
  a.endOffset === b.endOffset;

const ResultContent: FC<{ data: TranslationData; onClose?: () => void }> = ({ data, onClose }) => (
  <div className="w-72 rounded-md bg-popover p-3 text-popover-foreground shadow-md">
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm font-semibold">{data.text}</p>
      {onClose && (
        <Button type="button" size="icon-xs" variant="ghost" onClick={onClose} className="-mt-1 -mr-1 shrink-0">
          <XIcon />
          <span className="sr-only">Close</span>
        </Button>
      )}
    </div>
    <pre className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">
      {JSON.stringify({ before: data.before, text: data.text, after: data.after }, null, 2)}
    </pre>
  </div>
);

// Kept mounted at all times (not conditionally rendered by the parent on `data`), so it can retain
// the last selection's content and play its own exit transition once `data` clears - the parent
// unmounting it immediately on dismiss would tear the transition down before it had a chance to run.
//
// One shared implementation for both desktop and touch, rather than touch getting its own fixed
// bottom sheet: a sheet pinned to the bottom of the screen collides with the native "search Google
// for..." bar mobile browsers show under a selection, which can cover it entirely. Anchoring to the
// selection instead - with flip() falling back above when there's no room below - keeps clear of
// that the same way it already keeps clear of desktop's own edge cases.
const Popover: FC<PanelProps> = ({ data, onClear }) => {
  const [renderData, setRenderData] = useState(data);
  const [showResult, setShowResult] = useState(false);

  // Adjusts state during render rather than in an effect (React's documented pattern for "resetting
  // state when a prop changes") - `data` is a fresh object per selection, so this only re-fires on an
  // actual new selection, not on every render.
  if (data && data !== renderData) {
    setRenderData(data);
    setShowResult(false);
  }

  const { refs, floatingStyles, isMounted, transitionStyles, getReferenceProps, getFloatingProps } =
    useSelectionFloating({
      open: data !== null,
      onOpenChange: (next) => {
        if (!next) onClear();
      },
      range: renderData?.range ?? null,
      gapPx: GAP_PX,
    });

  if (!isMounted || !renderData) return null;

  return (
    <FloatingPortal>
      <div
        // `refs.setFloating` is Floating UI's documented callback ref for the floating element (see
        // floating-ui.com/docs/react-dom#setfloating), not a `.current` read; this rule's static ref
        // analysis can't tell the two apart.
        // eslint-disable-next-line react-hooks/refs
        ref={refs.setFloating}
        style={{ ...floatingStyles, ...transitionStyles }}
        className="z-30"
        {...getFloatingProps()}
        // A mousedown's default action is what collapses the page's text selection (the trigger and
        // the result panel are otherwise unrelated to that selection) - preventing it here keeps the
        // selection highlighted for as long as this panel is open, through any click inside it.
        onMouseDown={(event) => event.preventDefault()}
        // Without this, a still-active selection means every click/keypress in here (not just the
        // one that opened the panel) reads to `useSelection`'s document-wide listener as a brand new
        // selection - which would reset `showResult` back to the trigger via the state-adjustment
        // above. Stopping propagation here keeps that listener from ever seeing these events.
        onPointerUp={(event) => event.stopPropagation()}
        onKeyUp={(event) => event.stopPropagation()}
      >
        {showResult ? (
          <ResultContent data={renderData} onClose={onClear} />
        ) : (
          <Button
            type="button"
            size="icon-sm"
            onClick={() => {
              // The OS's native selection menu (Copy/Search/Share) is tied to the touch gesture that
              // created the selection, not to whether a selection currently exists - our mousedown
              // guard keeps the selection alive, but leaves that menu open on top of the result.
              // Collapsing it dismisses that menu, but re-adding the identical range in the very same
              // tick doesn't give the browser a chance to actually register the collapse first, so
              // the menu never visibly goes away. One frame's gap is enough for the dismissal to land
              // before the highlight comes back.
              const selection = window.getSelection();
              selection?.removeAllRanges();
              requestAnimationFrame(() => selection?.addRange(renderData.range.cloneRange()));

              setShowResult(true);
            }}
            // The outline variant relies on ambient text color and a near-white border, both fine
            // for buttons living in the app's own chrome - but this one floats over arbitrary PDF
            // page content (often white), so it needs its own explicit, high-contrast styling.
            className="shadow-md hover:bg-primary"
            {...getReferenceProps()}
          >
            <Languages />
            <span className="sr-only">Translate selection</span>
          </Button>
        )}
      </div>
    </FloatingPortal>
  );
};

export const TranslationPopover: FC = () => {
  const [data, setData] = useState<TranslationData | null>(null);

  useSelection((selection) => {
    const range = selection.getRangeAt(0);

    // This fires right as the gesture that made the selection ends (pointerup fires the instant a
    // finger lifts) - the same moment some mobile browsers are still deciding whether to show their
    // own selection handles/menu. Mutating the DOM synchronously here (setData below, showing our own
    // trigger) can apparently race that and make the native UI not show up at all. One frame's delay
    // lets it render first.
    requestAnimationFrame(() => {
      // The panel keeps the browser selection alive while it's open (see the mousedown guard in
      // Popover), so any click on it that still lets a pointerup/selectionchange reach here (its own
      // trigger included) re-detects the very same selection, not a new one - without this check, that
      // resets the panel back to the trigger, flickering it open and shut.
      //
      // Compared on the un-corrected range: correctRange (below) can map two different selections
      // (e.g. "Martin" and just "M" inside it) onto the exact same corrected range, and comparing that
      // would wrongly treat a genuine shrink/extension as "nothing changed" and drop it.
      if (data && isSameRange(range, data.range)) return;

      // correctRange's word-expanded range only ever exists here, as a local value used to derive the
      // translated text/context - nothing downstream needs the Range object itself, only these strings.
      const corrected = correctRange(range);
      const text = corrected.toString().trim();
      if (text.length > MAX_SELECTION_LENGTH) return;

      const { before, after } = getContext(corrected);

      setData({ range: range.cloneRange(), before, text, after });
    });
  });

  useHideGoogleTranslateExtensionPopup();

  // The panel keeps the page's text selection alive while it's open (see the mousedown guard in
  // Popover) instead of clearing it up front, so it's cleared here instead - once the panel actually
  // closes, whatever reason that was (outside click, Escape, the panel's own close button).
  const onClear = () => {
    window.getSelection()?.removeAllRanges();
    setData(null);
  };

  return <Popover data={data} onClear={onClear} />;
};
