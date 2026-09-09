import { useEffect, useState } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const BASE_ZOOM = 1;
const ZOOM_STEP = 0.25;
const ZOOM_STORAGE_KEY = 'pdf-zoom';

export const MIN_ZOOM_PERCENT = MIN_ZOOM * 100;
export const MAX_ZOOM_PERCENT = MAX_ZOOM * 100;

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export const usePdfZoom = () => {
  const [zoomLevel, setZoomLevel] = useState(BASE_ZOOM);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // Reads the stored zoom only after mount, so the client's first render (the one React
  // reconciles against the server-rendered HTML) always starts at BASE_ZOOM like the server did -
  // reading localStorage during that render would mismatch whenever a non-default zoom is stored.
  useEffect(() => {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY);
    const stored = raw === null ? NaN : Number(raw);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deferred read is the whole point, see comment above
    if (Number.isFinite(stored)) setZoomLevel(clampZoom(stored));
    setIsStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (!isStorageLoaded) return;
    localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomLevel));
  }, [isStorageLoaded, zoomLevel]);

  return {
    zoomLevel,
    canZoomIn: zoomLevel < MAX_ZOOM,
    canZoomOut: zoomLevel > MIN_ZOOM,
    zoomIn: () => setZoomLevel((zoom) => clampZoom(zoom + ZOOM_STEP)),
    zoomOut: () => setZoomLevel((zoom) => clampZoom(zoom - ZOOM_STEP)),
    setZoom: (percent: number) => setZoomLevel(clampZoom(Math.round(percent) / 100)),
  };
};
