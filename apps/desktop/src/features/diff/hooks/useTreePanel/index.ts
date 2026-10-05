import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useEscapeLayer } from '@goodboy/ui';

type Params = {
  readonly isNarrow: boolean;
};

export type TreePanel = {
  readonly isOpen: boolean;
  readonly asideRef: RefObject<HTMLElement | null>;
  readonly stripRef: RefObject<HTMLButtonElement | null>;
  readonly toggle: () => void;
  readonly focus: () => void;
  readonly focusFilter: () => void;
  readonly dismiss: () => void;
};

const FILTER_SELECTOR = '[data-diff-filter]';

export const useTreePanel = ({ isNarrow }: Params): TreePanel => {
  const [isDocked, setIsDocked] = useState(true);
  const [isOverlay, setIsOverlay] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);
  const stripRef = useRef<HTMLButtonElement | null>(null);
  const focusPending = useRef<(() => void) | null>(null);
  const isOpen = isNarrow ? isOverlay : isDocked;
  const setOpen = isNarrow ? setIsOverlay : setIsDocked;

  const focusRow = useCallback(() => {
    const aside = asideRef.current;
    const current = aside?.querySelector<HTMLElement>('[aria-current="true"]');
    (current ?? aside?.querySelector<HTMLElement>('button'))?.focus();
  }, []);

  const focusFilterField = useCallback(() => {
    asideRef.current?.querySelector<HTMLElement>(FILTER_SELECTOR)?.focus();
  }, []);

  const toggle = useCallback(() => setOpen((open) => !open), [setOpen]);

  const focusWith = useCallback(
    (target: () => void) => {
      if (isOpen) {
        target();
        return;
      }
      focusPending.current = target;
      setOpen(true);
    },
    [isOpen, setOpen],
  );

  const focus = useCallback(() => focusWith(focusRow), [focusRow, focusWith]);
  const focusFilter = useCallback(() => focusWith(focusFilterField), [focusFilterField, focusWith]);

  const dismiss = useCallback(() => {
    if (isNarrow) {
      setIsOverlay(false);
    }
  }, [isNarrow]);

  useEffect(() => {
    if (isOpen && focusPending.current !== null) {
      const target = focusPending.current;
      focusPending.current = null;
      target();
    }
  }, [isOpen]);

  useEscapeLayer(() => {
    setIsOverlay(false);
    stripRef.current?.focus();
  }, isNarrow && isOverlay);

  return { isOpen, asideRef, stripRef, toggle, focus, focusFilter, dismiss };
};
