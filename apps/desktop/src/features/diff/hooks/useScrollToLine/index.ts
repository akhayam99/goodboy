import { useEffect, type RefObject } from 'react';
import { appScrollIntoView } from '@goodboy/ui';

type Params = {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly path: string;
  readonly line: number;
};

const FLASH_MS = 1000;
const FLASH_ATTRIBUTE = 'data-peek-flash';

export const useScrollToLine = ({ containerRef, path, line }: Params) => {
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    let flashed: Element | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reveal = (): boolean => {
      const row = container.querySelector(`[data-line="new:${line}"]`)?.closest('[role="row"]');
      if (row == null) {
        return false;
      }
      appScrollIntoView({ element: row, block: 'center' });
      row.setAttribute(FLASH_ATTRIBUTE, '');
      flashed = row;
      timer = setTimeout(() => flashed?.removeAttribute(FLASH_ATTRIBUTE), FLASH_MS);
      return true;
    };
    const observer = new MutationObserver(() => {
      if (reveal()) {
        observer.disconnect();
      }
    });
    if (!reveal()) {
      observer.observe(container, { childList: true, subtree: true });
    }
    return () => {
      observer.disconnect();
      if (timer !== null) {
        clearTimeout(timer);
      }
      flashed?.removeAttribute(FLASH_ATTRIBUTE);
    };
  }, [containerRef, path, line]);
};
