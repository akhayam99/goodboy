export const OVERLAY_SELECTOR = [
  '[data-dropdown-portal]',
  '[role="dialog"]',
  '[role="menu"]',
  '[role="listbox"]:not([aria-multiselectable="true"])',
  '[role="alertdialog"]',
].join(', ');
