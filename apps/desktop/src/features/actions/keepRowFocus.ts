import { captureReturnFocus } from '@goodboy/ui';
import type { ShowToast, ShowToastParams } from '../../shared/components/Toast/toastContext';
import { OBJECT_ROW_SELECTOR as ROW_SELECTOR } from './objectRowSelector';

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

const UNDO_LABEL = 'Undo';

const UNDO_FRAMES = 30;

type Params = {
  readonly anchor: HTMLElement | null;
  readonly showToast: ShowToast;
};

type KeyParams = {
  readonly row: Element | null;
};

type RefocusParams = {
  readonly key: string;
  readonly frames: number;
};

type RowFocus = {
  readonly restore: () => void;
  readonly showToast: ShowToast;
};

const rowIdentityOf = ({ row }: KeyParams): string | null => {
  if (row === null) {
    return null;
  }
  const named = row.getAttribute('data-select-id') ?? row.getAttribute('data-row') ?? '';
  if (named !== '') {
    return named;
  }
  return row.querySelector('[data-row-key]')?.getAttribute('data-row-key') ?? null;
};

const refocusRow = ({ key, frames }: RefocusParams): void => {
  const back = Array.from(document.querySelectorAll(ROW_SELECTOR)).find(
    (row) => rowIdentityOf({ row }) === key,
  );
  if (back instanceof HTMLElement) {
    const inner = back.matches(FOCUSABLE) ? back : back.querySelector(FOCUSABLE);
    (inner instanceof HTMLElement ? inner : back).focus();
    return;
  }
  if (frames > 0) {
    requestAnimationFrame(() => refocusRow({ key, frames: frames - 1 }));
  }
};

export const keepRowFocus = ({ anchor, showToast }: Params): RowFocus => {
  const key = rowIdentityOf({ row: anchor?.closest(ROW_SELECTOR) ?? null });
  const withUndoFocus = ({ action, ...toast }: ShowToastParams): void => {
    if (key === null || action === undefined || action.label !== UNDO_LABEL) {
      showToast({ ...toast, ...(action !== undefined && { action }) });
      return;
    }
    showToast({
      ...toast,
      action: {
        ...action,
        onClick: () => {
          action.onClick();
          refocusRow({ key, frames: UNDO_FRAMES });
        },
      },
    });
  };
  return {
    restore: captureReturnFocus({ anchor, rowSelector: ROW_SELECTOR }),
    showToast: withUndoFocus,
  };
};
