import { useEffect } from 'react';
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

export const useSelectionFloating = ({ open, onOpenChange, range, gapPx }: Options) => {
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement: 'bottom',
    middleware: [offset(gapPx), flip(), shift({ padding: gapPx })],
    // ancestorScroll off: the panel is positioned once (`position: absolute`, so it still scrolls
    // naturally with the page) rather than re-measured on every scroll tick - re-measuring would keep
    // reading the selection Range's rect while the page scrolls, which snaps the panel to (0, 0) once
    // the PDF reader's virtualizer unmounts the page the selection lives on. Freezing the computed
    // position avoids that, and it means scrolling away and back no longer has to re-anchor anything.
    whileElementsMounted: (referenceEl, floatingEl, update) =>
      autoUpdate(referenceEl, floatingEl, update, { ancestorScroll: false }),
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
      getBoundingClientRect: () => range.getBoundingClientRect(),
      contextElement: contextElement ?? undefined,
    });
  }, [range, refs]);

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, { duration: 200 });

  // No ancestorScroll dismiss either - the panel now stays put through a scroll instead of vanishing,
  // so closing it is only ever explicit (an outside press, or the panel's own close button).
  //
  // outsidePressEvent: 'click' (not the default 'pointerdown') matters specifically for touch - a
  // scroll starts with a touch/pointerdown outside the panel same as a dismiss tap does, and the
  // default would treat starting to scroll the page as a press to dismiss, before any scrolling even
  // happens. A drag suppresses the click a plain tap would otherwise fire at gesture-end, so waiting
  // for that lets a scroll pass through untouched while a genuine outside tap still dismisses.
  const dismiss = useDismiss(context, { outsidePress: true, outsidePressEvent: 'click', ancestorScroll: false });
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
