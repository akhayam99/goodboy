import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import type { TreeRailMode } from '../../treeRailMode';

type Params = {
  readonly mode: TreeRailMode;
};

export type TreePanel = {
  readonly isOpen: boolean;
  readonly isOverlay: boolean;
  readonly asideRef: RefObject<HTMLElement | null>;
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
  readonly toggle: () => void;
  readonly fold: () => void;
  readonly focus: () => void;
  readonly focusFilter: () => void;
  readonly dismiss: () => void;
};

const TREE_SELECTOR = 'nav';
const FILTER_SELECTOR = '[data-diff-filter]';
const POPOVER_SELECTOR = '[data-dropdown-portal]';

export const useTreePanel = ({ mode }: Params): TreePanel => {
  const isOverlayMode = mode !== 'docked';
  const [isDocked, setIsDocked] = useState(true);
  const [isOverlayShown, setIsOverlayShown] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const focusPending = useRef<(() => void) | null>(null);
  const returnFocus = useRef(false);
  const isOpen = isOverlayMode ? isOverlayShown : isDocked;
  const setOpen = isOverlayMode ? setIsOverlayShown : setIsDocked;
  const isOverlay = isOverlayMode && isOverlayShown;

  const focusRow = useCallback(() => {
    const tree = asideRef.current?.querySelector<HTMLElement>(TREE_SELECTOR);
    const current = tree?.querySelector<HTMLElement>('[aria-current="true"]');
    (current ?? tree?.querySelector<HTMLElement>('button'))?.focus();
  }, []);

  const focusFilterField = useCallback(() => {
    asideRef.current?.querySelector<HTMLElement>(FILTER_SELECTOR)?.focus();
  }, []);

  const toggle = useCallback(() => setOpen((open) => !open), [setOpen]);

  const fold = useCallback(() => {
    returnFocus.current = true;
    setOpen(false);
  }, [setOpen]);

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
    if (isOverlayMode) {
      setIsOverlayShown(false);
    }
  }, [isOverlayMode]);

  useEffect(() => {
    if (isOpen && focusPending.current !== null) {
      const target = focusPending.current;
      focusPending.current = null;
      target();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && returnFocus.current) {
      returnFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  useEscapeLayer(fold, isOverlay);

  useEffect(() => {
    if (!isOverlay) {
      return;
    }
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const isInside =
        asideRef.current?.contains(target) === true ||
        triggerRef.current?.contains(target) === true ||
        target.closest(POPOVER_SELECTOR) !== null;
      if (!isInside) {
        setIsOverlayShown(false);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [isOverlay]);

  return { isOpen, isOverlay, asideRef, triggerRef, toggle, fold, focus, focusFilter, dismiss };
};
