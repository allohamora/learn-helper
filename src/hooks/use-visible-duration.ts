import { useEffect, useRef } from 'react';

// Tracks elapsed time only while the document tab is visible - hidden-tab intervals
// (switched tabs, minimized/hid the browser) are excluded.
export const useVisibleDuration = () => {
  const activeSinceRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);

  useEffect(() => {
    activeSinceRef.current = document.visibilityState === 'visible' ? Date.now() : null;

    const onVisibilityChange = () => {
      const since = activeSinceRef.current;
      if (document.visibilityState === 'hidden') {
        if (since !== null) accumulatedMsRef.current += Date.now() - since;
        activeSinceRef.current = null;
      } else {
        activeSinceRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Folds time visible since the last peek/take/commit (or mount) into the accumulator.
  const foldElapsedMs = () => {
    const since = activeSinceRef.current;
    const now = Date.now();
    if (since !== null) {
      accumulatedMsRef.current += now - since;
      activeSinceRef.current = document.visibilityState === 'visible' ? now : null;
    }
  };

  // Returns the visible-only ms elapsed since the last call (or mount), then resets to 0.
  // Idempotent w.r.t. the visibilitychange listener above - safe to call at any point, hidden or
  // visible, without double-counting or going negative.
  const takeElapsedMs = () => {
    foldElapsedMs();

    const ms = accumulatedMsRef.current;
    accumulatedMsRef.current = 0;
    return ms;
  };

  // Same fold as takeElapsedMs, but returns the running total without clearing it - safe to call
  // before an operation that might fail, so the elapsed time isn't lost if it does. Pair with
  // commitElapsedMs once the operation succeeds.
  const peekElapsedMs = () => {
    foldElapsedMs();
    return accumulatedMsRef.current;
  };

  // Removes an already-reported duration once its flush succeeds. Any time that accumulated
  // after the matching peek (e.g. while the request was in flight) is kept.
  const commitElapsedMs = (ms: number) => {
    accumulatedMsRef.current -= ms;
  };

  return { takeElapsedMs, peekElapsedMs, commitElapsedMs };
};
