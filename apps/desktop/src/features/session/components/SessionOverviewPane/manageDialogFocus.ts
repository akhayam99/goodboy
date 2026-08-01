type Params = {
  readonly dialog: HTMLElement;
  readonly returnFocusTo: HTMLElement;
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export const manageDialogFocus = ({ dialog, returnFocusTo }: Params) => {
  const focusableElements = () =>
    Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => element.getAttribute('aria-hidden') !== 'true',
    );

  const initialFocus = focusableElements()[0] ?? dialog;
  initialFocus.focus();

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') {
      return;
    }
    const elements = focusableElements();
    if (elements.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || dialog.contains(document.activeElement) === false)
    ) {
      event.preventDefault();
      last?.focus();
      return;
    }
    if (event.shiftKey === false && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  dialog.addEventListener('keydown', onKeyDown);
  return () => {
    dialog.removeEventListener('keydown', onKeyDown);
    returnFocusTo.focus();
  };
};
