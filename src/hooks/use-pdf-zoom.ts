import { useEffect, useState } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const BASE_ZOOM = 1;
const ZOOM_STEP = 0.25;
const ZOOM_STORAGE_KEY = 'pdf-zoom';

export const MIN_ZOOM_PERCENT = MIN_ZOOM * 100;
export const MAX_ZOOM_PERCENT = MAX_ZOOM * 100;

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

const getStoredZoom = () => {
  const stored = Number(localStorage.getItem(ZOOM_STORAGE_KEY));

  return stored ? clampZoom(stored) : BASE_ZOOM;
};

export const usePdfZoom = () => {
  const [zoomLevel, setZoomLevel] = useState(getStoredZoom);

  useEffect(() => {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomLevel));
  }, [zoomLevel]);

  return {
    zoomLevel,
    canZoomIn: zoomLevel < MAX_ZOOM,
    canZoomOut: zoomLevel > MIN_ZOOM,
    zoomIn: () => setZoomLevel((zoom) => clampZoom(zoom + ZOOM_STEP)),
    zoomOut: () => setZoomLevel((zoom) => clampZoom(zoom - ZOOM_STEP)),
    setZoom: (percent: number) => setZoomLevel(clampZoom(Math.round(percent) / 100)),
  };
};
