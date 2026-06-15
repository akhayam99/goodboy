import { useEffect } from 'react';
import { applyStoredZoom, zoomIn, zoomOut, zoomReset } from '../../lib/zoom';

const ZOOM_ACTIONS: Record<string, () => Promise<void>> = {
  '=': zoomIn,
  '+': zoomIn,
  '-': zoomOut,
  _: zoomOut,
  '0': zoomReset,
};

export const useZoomShortcuts = (): void => {
  useEffect(() => {
    void applyStoredZoom();
    const onShortcut = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) {
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        window.location.reload();
        return;
      }
      const action = ZOOM_ACTIONS[e.key];
      if (!action) {
        return;
      }
      e.preventDefault();
      void action();
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);
};
