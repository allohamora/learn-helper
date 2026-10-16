import { useEffect, useRef } from 'react';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  useTransitionStyles,
} from '@floating-ui/react';
import { useMediaQuery } from '@/hooks/use-media-query';

type Options = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range: Range | null;
  // Android/iOS commonly render their own copy/paste toolbar directly above a selection, and always
  // place a draggable handle at its bottom-right corner - a panel placed at either spot competes with
  // native UI for taps and generally loses. Hypothesis's client (a mature open-source annotator that
  // solves this same problem across browsers - see its `adder.tsx`) defaults to placing its toolbar
  // below the selection for this reason, falling back to above only when there isn't room below -
  // `placement: 'bottom'` plus `flip()` reproduces that. `gapPx` is also reused as shift()'s edge
  // clearance, and is caller-provided since touch wants more breathing room than a mouse cursor does.
  gapPx: number;
};

// A real selection is never actually 0x0 - so a zero-sized rect means the Range's nodes have gone
// stale, not that the selection genuinely shrank to nothing. That covers both ways the PDF reader's
// virtualizer can invalidate the page a selection lives on: fully unmounting it (a detached node
// reports zero), and - as confirmed on-device with react-pdf's real text layer - reusing a virtualized
// page slot's existing DOM nodes for a different page's content instead of unmounting them (the old
// Range's nodes stay attached, so `isConnected` can't tell stale from live here, but still briefly
// report a zero rect while their content is swapped out).
const isRangeStale = (range: Range) => {
  const rect = range.getBoundingClientRect();
  return rect.width === 0 && rect.height === 0;
};

export const useSelectionFloating = ({ open, onOpenChange, range, gapPx }: Options) => {
  // Whether *this* range has reported a genuine (non-zero) rect at least once. Gating the stale check
  // below on this avoids a false positive on the very first measurement, before layout has had any
  // chance to settle - a real selection's first reading has never actually been observed to be zero,
  // but happy-dom's lack of a layout engine always reports one, and there's no reason to assume a real
  // browser could never do the same for a frame.
  const hasHadValidRectRef = useRef(false);

  useEffect(() => {
    hasHadValidRectRef.current = false;
  }, [range]);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement: 'bottom',
    middleware: [offset(gapPx), flip(), shift({ padding: gapPx })],
    // ancestorScroll and layoutShift are both off so an ordinary scroll alone never re-measures the
    // panel - it's positioned once (`position: absolute`, so it still scrolls naturally with the
    // page) rather than on every scroll tick. layoutShift needs calling out specifically: its
    // move-tracking IntersectionObserver fires on ordinary scrolling too (its rootMargin is built
    // from the reference's current viewport position, so any scroll looks like movement to it), not
    // just on genuine content reflow. elementResize stays on: besides being what re-runs flip/shift
    // when the panel itself grows from the small trigger icon to the much larger result card, its
    // ResizeObserver on the reference element is also what notifies this once the selection's page
    // gets recycled by the virtualizer - the check below closes the popover right then, rather than
    // computing a position from a reference that no longer means anything.
    whileElementsMounted: (referenceEl, floatingEl, update) =>
      autoUpdate(
        referenceEl,
        floatingEl,
        () => {
          if (range && hasHadValidRectRef.current && isRangeStale(range)) {
            onOpenChange(false);
            return;
          }
          update();
        },
        { ancestorScroll: false, layoutShift: false },
      ),
  });

  // Bound to the selection Range's live rect rather than a snapshot, so autoUpdate can reposition
  // the panel while a drag extends/shrinks the selection, not just once at selection-end.
  // contextElement lets autoUpdate/useDismiss find the real scrollable ancestors (here, the window)
  // to observe - without it, a virtual reference has no DOM node to walk up from.
  useEffect(() => {
    if (!range) return;

    const contextElement =
      range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;

    refs.setReference({
      getBoundingClientRect: () => {
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) hasHadValidRectRef.current = true;
        return rect;
      },
      contextElement: contextElement ?? undefined,
    });
  }, [range, refs]);

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, { duration: 200 });

  // No ancestorScroll dismiss either - the panel now stays put through a scroll instead of vanishing,
  // so closing it is only ever explicit (an outside press, the panel's own close button, or the
  // selection's page going stale - see isRangeStale above).
  //
  // outsidePressEvent needs to be 'click' rather than the default 'pointerdown' on touch specifically:
  // a scroll starts with the same touchstart a dismiss tap does, and dismissing on that would close the
  // panel the instant you start scrolling past it, before any scrolling even happens - a drag suppresses
  // the click a plain tap would otherwise fire at gesture-end, so waiting for that lets a scroll pass
  // through untouched while a genuine outside tap still dismisses.
  //
  // A mouse has no equivalent problem: wheel-scrolling never fires a pointerdown at all, and dragging
  // the scrollbar itself is separately exempted by useDismiss's own scrollbar check - so a fine pointer
  // can just use the plain 'pointerdown' default, which also sidesteps a different desktop-only wrinkle
  // for free: a mouse drag that selects new text elsewhere on the page still ends in a real click
  // (unlike a touch drag), which 'click' can't tell apart from a genuine dismiss press without extra
  // bookkeeping. Dismissing on pointerdown instead means that click never reaches this check to begin
  // with - the old popover already closed the moment the new drag started, exactly as clicking away to
  // start a new selection should.
  const isCoarsePointer = useMediaQuery('(pointer: coarse)');
  const dismiss = useDismiss(context, {
    outsidePressEvent: isCoarsePointer ? 'click' : 'pointerdown',
    ancestorScroll: false,
  });
  const role = useRole(context, { role: 'dialog' });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

  return {
    refs,
    floatingStyles,
    isMounted,
    transitionStyles,
    getReferenceProps,
    getFloatingProps,
  };
};
