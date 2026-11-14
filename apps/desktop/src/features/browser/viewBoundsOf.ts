import type { createOverlayWatch } from './createOverlayWatch';
import type { BrowserBounds } from './types';

type Params = {
  readonly view: HTMLElement | null;
  readonly overlays: Pick<ReturnType<typeof createOverlayWatch>, 'covers'>;
  readonly zoom: number;
  readonly maxWidth?: number | null;
};

export const viewBoundsOf = ({
  view,
  overlays,
  zoom,
  maxWidth = null,
}: Params): BrowserBounds | null => {
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
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const width = maxWidth === null ? rect.width : Math.min(rect.width, maxWidth);
  const left = Math.round((rect.left + (rect.width - width) / 2) * scale);
  const top = Math.round(rect.top * scale);
  const right = Math.round((rect.left + (rect.width + width) / 2) * scale);
  const bottom = Math.round((rect.top + rect.height) * scale);
  return { x: left, y: top, width: right - left, height: bottom - top };
};
