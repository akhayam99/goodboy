const OVERLAY_SELECTOR =
  '[data-dropdown-portal], [role="dialog"], [role="menu"], [role="listbox"], [role="alertdialog"]';

type Params = Record<never, never>;

export const isOverlayOpen = ({}: Params): boolean =>
  typeof document !== 'undefined' && document.querySelector(OVERLAY_SELECTOR) !== null;
