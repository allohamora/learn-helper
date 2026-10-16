import { useEffectEvent, useLayoutEffect } from 'react';

// Android Chrome's long-press-to-select and its selection-handle drags are native, OS-level
// gestures that often never dispatch a pointerup back to the page, so selectionchange is the only
// reliable signal there. It fires on every intermediate handle movement though, so it's debounced
// to only act once the selection settles - long enough to coalesce those rapid intermediate events,
// short enough that the trigger appearing doesn't read as a stuck/laggy response to finishing a drag.
const SELECTION_CHANGE_DEBOUNCE_MS = 150;

export const useSelection = (callback: (selection: Selection) => void) => {
  const onSelect = useEffectEvent(callback);

  useLayoutEffect(() => {
    // pointerup covers both mouse and touch drags ending; keyup covers keyboard selection (e.g.
    // shift+arrow, or a held arrow key's single keyup once released). Either way, this only fires
    // once the gesture that changed the selection has actually finished, not on a fixed interval
    // while it's still in progress.
    const handleSelectionEnd = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
      if (!selection.toString().trim()) return;

      onSelect(selection);
    };

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const handleSelectionChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(handleSelectionEnd, SELECTION_CHANGE_DEBOUNCE_MS);
    };

    document.addEventListener('pointerup', handleSelectionEnd);
    document.addEventListener('keyup', handleSelectionEnd);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      clearTimeout(debounceTimer);
      document.removeEventListener('pointerup', handleSelectionEnd);
      document.removeEventListener('keyup', handleSelectionEnd);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);
};
