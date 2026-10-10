import type { RefObject } from 'react';

export const focusComposerTextarea = (wrapperRef: RefObject<HTMLDivElement | null>) => {
  wrapperRef.current?.querySelector('textarea')?.focus({ preventScroll: true });
};
