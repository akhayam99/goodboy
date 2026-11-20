import { isOverlayOpen } from './isOverlayOpen';

type Params = Record<never, never>;

const HOVER_SURFACE_SELECTOR = '[data-hover-surface]';

export const isEscapeTakenAbove = ({}: Params): boolean =>
  isOverlayOpen({}) ||
  (typeof document !== 'undefined' && document.querySelector(HOVER_SURFACE_SELECTOR) !== null);
