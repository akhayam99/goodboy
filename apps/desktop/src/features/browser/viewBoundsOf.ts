import type { createOverlayWatch } from './createOverlayWatch';
import type { BrowserBounds } from './types';

type Params = {
  readonly view: HTMLElement | null;
  readonly overlays: Pick<ReturnType<typeof createOverlayWatch>, 'covers'>;
};

export const viewBoundsOf = ({ view, overlays }: Params): BrowserBounds | null => {
  if (view === null || !view.isConnected) {
    return null;
  }
  const rect = view.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    return null;
  }
  if (typeof view.checkVisibility === 'function' && !view.checkVisibility()) {
    return null;
  }
  if (overlays.covers({ view, rect })) {
    return null;
  }
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
};
