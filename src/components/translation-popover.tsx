import { type FC, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FloatingPortal } from '@floating-ui/react';
import { Check, Languages, Loader2, Plus, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { apiRequest, appClient } from '@/services/api';
import { useSelection } from '@/hooks/use-selection';
import { useSelectionFloating } from '@/hooks/use-selection-floating';
import { useHideGoogleTranslateExtensionPopup } from '@/hooks/use-hide-google-translate-extension-popup';
import { correctRange, getContext } from '@/utils/selection';

type TranslationData = {
  // The exact selection the user made. Anchors the trigger/panel position and tells one selection
  // apart from another (isSameRange) - correctRange()'s word-expanded version of it can map two
  // different selections (e.g. "Martin" and just "M" inside it) onto the same range, so comparing
  // that instead would wrongly treat a genuine shrink/extension as "nothing changed".
  range: Range;
  // correctRange()'s word-expanded version of `range`, computed once up front since translation
  // already needs it to derive `text`/`before`/`after` below. Reused here to restore the on-screen
  // selection when the trigger is clicked (see Popover's onClick) - so e.g. selecting "ell" inside
  // "hello" and clicking the trigger highlights the whole word "hello", matching what gets translated,
  // while also still dismissing Android's native selection toolbar the same way.
  correctedRange: Range;
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
  readingId: string;
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

// A small, bidirectional horizontal pan used to become available on real Android Chrome hardware
// (never reproduced on desktop or in DevTools' mobile emulation) whenever this panel was open, gone
// again the instant it closed - overflow-x: clip on html/body and removing every floating-ui
// middleware both had zero effect, so it isn't page layout/overflow. The likely cause is the Popover
// trigger's removeAllRanges()/addRange() dance re-poking the native Selection specifically to dismiss
// Android's own selection toolbar (see that onClick below) reacting to this panel's size - i.e. native
// browser chrome, not something CSS on this panel can reach. w-56 (and the original w-72) reproduced
// it; w-54 and everything smaller tried (w-52, w-44) were confirmed on-device to not reproduce it - so
// w-54 here is the largest confirmed-safe width. md: (not a touch-device query) since this is a plain
// viewport-width breakpoint, same convention
// pdf-reader.tsx already uses.
//
// This is a fixed width, not min-w/max-w, for a second, separate reason: a min-w/max-w pair (width:
// auto, shrink-to-fit) was tried to size the panel to its content instead of always rendering at the
// max - it worked everywhere except real Android Chrome, where a long translation made the panel
// render far wider than max-w, confirmed unrelated to CSS specificity (adding !important to max-w had
// zero effect) and unrelated to react-pdf's CSS (TextLayer.css/AnnotationLayer.css scope every rule
// under .textLayer/.annotationLayer, no bare `p` selector to leak). The likely mechanism: this exact
// node is both (a) the one whose width the browser has to shrink-to-fit-compute from its own content,
// and (b) the one autoUpdate's elementResize ResizeObserver (above) is actively watching to reposition
// on - Android Chrome's implementation of that combination is apparently unreliable in a way desktop
// Chrome and DevTools' mobile emulation both fail to reproduce. Switching this back to a fixed width
// (no shrink-to-fit computation at all) fixed it immediately and completely.
//
// A real fix for genuine per-content dynamic width - without going back through shrink-to-fit on this
// exact watched/positioned node - would be to measure the content's natural width in a separate,
// off-screen/unobserved element (position: fixed, visibility: hidden, width: fit-content - safe to
// shrink-to-fit since nothing watches or repositions it), read it via getBoundingClientRect() in a
// layout effect, clamp it, and apply it here as an explicit style={{ width: px }} - never `auto` - so
// this node itself never has to resolve an auto width while autoUpdate is watching it. Not implemented
// (adds a measuring ref + a layout effect + a measure-then-apply render pass) - fixed width for now.
const ResultContent: FC<{ readingId: string; data: TranslationData; onClose?: () => void }> = ({
  readingId,
  data,
  onClose,
}) => {
  const {
    data: result,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['translation', readingId, data.text, data.before, data.after],
    queryFn: () =>
      apiRequest(
        () =>
          appClient.api.v1.users.me.readings[':readingId'].translations.$post({
            param: { readingId },
            json: { text: data.text, before: data.before, after: data.after },
          }),
        'Failed to translate selection',
      ),
    // A given (text, before, after) selection always translates the same way - never refetch it,
    // so re-selecting the same word/phrase later in the same reading session (the popover unmounts
    // ResultContent on close, so this is what a plain useQuery would otherwise redo) reuses the
    // cached result instead of hitting the AI endpoint again.
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });

  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: () => {
      const context =
        data.before || data.after ? JSON.stringify({ before: data.before, after: data.after }) : undefined;

      return apiRequest(
        () =>
          appClient.api.v1.users.me['vocabulary-lists'].personal.items.generate.$post({
            json: { value: data.text, context },
          }),
        'Failed to add item',
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-items'] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-discover-items'] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-progress'] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-learn-items'] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-learn-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['personal-vocabulary-search'] });
      toast.success('Added to your vocabulary list');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to add item'),
  });

  return (
    <div className="w-54 overflow-hidden rounded-md bg-popover p-3 text-popover-foreground shadow-md md:w-72">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold md:text-sm">Translation</p>
        {onClose && (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={onClose}
            // The panel's own mousedown guard (preventDefault, to preserve the selection through a
            // click) has no reason to apply here specifically - closing already clears the selection
            // immediately via onClose. Left in place, it can suppress the synthesized click entirely on
            // some mobile browsers, so the first tap doesn't register as a click at all (only visible
            // side effects of the raw, un-clicked mousedown/touch happen) and it takes a second tap to
            // actually close. Stopping propagation here keeps that guard from ever seeing this press.
            onMouseDown={(event) => event.stopPropagation()}
            className="-mt-1 -mr-1 shrink-0"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        )}
      </div>

      <div className="mt-2">
        {isPending && (
          <div className="flex justify-center">
            <Loader className="items-center text-xs md:text-sm [&_svg]:size-3 md:[&_svg]:size-4" />
          </div>
        )}

        {isError && <p className="text-xs text-destructive md:text-sm">Failed to translate selection</p>}

        {result && <p className="text-xs break-words md:text-sm">{result.uaTranslation}</p>}
      </div>

      {result && (
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            size="xs"
            disabled={!result.canAddToLearningList || addMutation.isPending || addMutation.isSuccess}
            onClick={() => addMutation.mutate()}
            title={addMutation.isSuccess ? 'Added to learning list' : 'Add to learning list'}
            aria-label={addMutation.isSuccess ? 'Added to learning list' : 'Add to learning list'}
          >
            {addMutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : addMutation.isSuccess ? (
              <Check />
            ) : (
              <Plus />
            )}
            <span>{addMutation.isSuccess ? 'Added' : 'Add'}</span>
          </Button>
        </div>
      )}
    </div>
  );
};

// Kept mounted at all times (not conditionally rendered by the parent on `data`), so it can retain
// the last selection's content and play its own exit transition once `data` clears - the parent
// unmounting it immediately on dismiss would tear the transition down before it had a chance to run.
//
// One shared implementation for both desktop and touch, rather than touch getting its own fixed
// bottom sheet: a sheet pinned to the bottom of the screen collides with the native "search Google
// for..." bar mobile browsers show under a selection, which can cover it entirely. Anchoring to the
// selection instead - with flip() falling back above when there's no room below - keeps clear of
// that the same way it already keeps clear of desktop's own edge cases.
const Popover: FC<PanelProps> = ({ readingId, data, onClear }) => {
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
        className="z-30 select-none"
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
          <ResultContent readingId={readingId} data={renderData} onClose={onClear} />
        ) : (
          <Button
            type="button"
            size="icon-sm"
            onClick={() => {
              // The OS's native selection menu (Copy/Search/Share) is tied to the touch gesture that
              // created the selection, not to whether a selection currently exists - our mousedown
              // guard keeps the selection alive, but leaves that menu open on top of the result.
              // Collapsing it dismisses that menu, but re-adding a range in the very same tick doesn't
              // give the browser a chance to actually register the collapse first, so the menu never
              // visibly goes away. One frame's gap is enough for the dismissal to land before the
              // highlight comes back - as the word-corrected range, matching what's actually translated.
              const selection = window.getSelection();
              selection?.removeAllRanges();
              requestAnimationFrame(() => selection?.addRange(renderData.correctedRange.cloneRange()));

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

export const TranslationPopover: FC<{ readingId: string }> = ({ readingId }) => {
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
      // Checked against `data.range`, not just `data.correctedRange`: correctRange (below) can map two
      // different selections (e.g. "Martin" and just "M" inside it) onto the exact same corrected
      // range, and comparing only that would wrongly treat a genuine shrink/extension as "nothing
      // changed" and drop it.
      //
      // Also checked against `data.correctedRange`: the trigger's onClick (below) programmatically
      // replaces the live DOM selection with the word-corrected range, which fires this same
      // selectionchange path right back - comparing only `data.range` there would miss it (the DOM
      // selection is no longer the exact range the user dragged) and read it as a brand new selection,
      // which reset the panel back to the trigger the instant it was clicked.
      if (data && (isSameRange(range, data.range) || isSameRange(range, data.correctedRange))) return;

      const correctedRange = correctRange(range);
      const text = correctedRange.toString().trim();
      // Growing an already-tracked selection past the limit must actively clear `data`, not just skip
      // setting it - otherwise the popover stays anchored to the old, now-stale range instead of
      // disappearing, since nothing else re-renders it once this returns.
      if (!text || text.length > MAX_SELECTION_LENGTH) {
        setData(null);
        return;
      }

      const { before, after } = getContext(correctedRange);

      setData({ range: range.cloneRange(), correctedRange, before, text, after });
    });
  });

  useHideGoogleTranslateExtensionPopup();

  // The panel keeps the page's text selection alive while it's open (see the mousedown guard in
  // Popover) instead of clearing it up front, so it's cleared here instead - once the panel actually
  // closes, whatever reason that was (outside click, Escape, the panel's own close button).
  const onClear = () => {
    const selection = window.getSelection();

    // Android's native selection toolbar (Copy/Search/Share) isn't reliably tied to the Selection
    // object's state - removeAllRanges() alone can leave it stuck on screen (confirmed, still-open
    // upstream: WordPress/gutenberg#35447, no clean web-only fix even from their own core team).
    // What Android does respond to is some kind of "action" on the selection - re-applying the same
    // range via setBaseAndExtent (rather than mutating it) is the one thing their investigation found
    // that reliably registers as one, before the actual clear below.
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      selection.setBaseAndExtent(range.startContainer, range.startOffset, range.startContainer, range.startOffset);
    }

    selection?.removeAllRanges();
    setData(null);
  };

  return <Popover readingId={readingId} data={data} onClear={onClear} />;
};
