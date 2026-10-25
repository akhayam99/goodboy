import { useEffect } from 'react';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';

const ROW_ACTIONS_CUE_ATTRIBUTE = 'data-row-actions-cue';

const ROW_SELECTOR = '.group\\/row';

const ACTIONS_SELECTOR = '.row-actions';

const LIST_SELECTOR =
  'ul, ol, [role="list"], [role="tree"], [role="grid"], [role="listbox"], tbody';

const SEEN = '1';

const hasSeenCue = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEYS.rowActionsCue) === SEEN;
  } catch {
    return false;
  }
};

const rememberCue = (): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.rowActionsCue, SEEN);
  } catch {
    return;
  }
};

export const useRowActionsCue = (): void => {
  useEffect(() => {
    if (hasSeenCue()) {
      return;
    }
    let cued: Element | null = null;
    let isDone = false;
    const end = (): void => {
      cued?.removeAttribute(ROW_ACTIONS_CUE_ATTRIBUTE);
      cued = null;
    };
    const onLeave = (): void => {
      isDone = true;
      end();
      rememberCue();
    };
    const onOver = ({ target, pointerType }: PointerEvent): void => {
      if (isDone || cued !== null || pointerType !== 'mouse') {
        return;
      }
      if (!(target instanceof Element)) {
        return;
      }
      const row = target.closest(ROW_SELECTOR);
      if (row === null || row.querySelector(ACTIONS_SELECTOR) === null) {
        return;
      }
      const list = row.closest(LIST_SELECTOR) ?? row.parentElement;
      if (list === null) {
        return;
      }
      cued = list;
      list.setAttribute(ROW_ACTIONS_CUE_ATTRIBUTE, 'true');
      list.addEventListener('pointerleave', onLeave, { once: true });
    };
    document.addEventListener('pointerover', onOver, true);
    return () => {
      document.removeEventListener('pointerover', onOver, true);
      cued?.removeEventListener('pointerleave', onLeave);
      end();
    };
  }, []);
};
