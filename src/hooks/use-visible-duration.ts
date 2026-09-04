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

  // Returns the visible-only ms elapsed since the last call (or mount), then resets to 0.
  // Idempotent w.r.t. the visibilitychange listener above - safe to call at any point, hidden or
  // visible, without double-counting or going negative.
  const takeElapsedMs = () => {
    const since = activeSinceRef.current;
    const now = Date.now();
    if (since !== null) {
      accumulatedMsRef.current += now - since;
      activeSinceRef.current = document.visibilityState === 'visible' ? now : null;
    }

    const ms = accumulatedMsRef.current;
    accumulatedMsRef.current = 0;
    return ms;
  };

  return { takeElapsedMs };
};
