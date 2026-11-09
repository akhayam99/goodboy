import { OVERLAY_SELECTOR } from './overlaySelector';

type Params = Record<never, never>;

export const isOverlayOpen = ({}: Params): boolean =>
  typeof document !== 'undefined' && document.querySelector(OVERLAY_SELECTOR) !== null;
