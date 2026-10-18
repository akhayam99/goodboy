const OVERLAY_SELECTOR = [
  '[data-dropdown-portal]',
  '[role="dialog"]',
  '[role="menu"]',
  '[role="listbox"]:not([aria-multiselectable="true"])',
  '[role="alertdialog"]',
].join(', ');

type Params = Record<never, never>;

export const isOverlayOpen = ({}: Params): boolean =>
  typeof document !== 'undefined' && document.querySelector(OVERLAY_SELECTOR) !== null;
