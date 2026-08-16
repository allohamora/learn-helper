import { useEffectEvent, useLayoutEffect } from 'react';

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

    document.addEventListener('pointerup', handleSelectionEnd);
    document.addEventListener('keyup', handleSelectionEnd);

    return () => {
      document.removeEventListener('pointerup', handleSelectionEnd);
      document.removeEventListener('keyup', handleSelectionEnd);
    };
  }, []);
};
