import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { DrawerMode } from '../drawerGeometry';
import { mountExitSnapshot } from '../exitSnapshot';
import { useDrawerExit, type DrawerExit } from '../useDrawerExit';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

type Params = {
  readonly isOpen: boolean;
  readonly layoutMode: Exclude<DrawerMode, 'closed'>;
  readonly isParked: boolean;
};

export type DrawerPanel = {
  readonly cardRef: RefObject<HTMLDivElement | null>;
  readonly contentRef: RefObject<HTMLDivElement | null>;
  readonly exit: DrawerExit;
  readonly isOverlayExit: boolean;
  readonly isPushExit: boolean;
  readonly mountSnapshot: (node: HTMLDivElement | null) => void;
};

export const useDrawerPanel = ({ isOpen, layoutMode, isParked }: Params): DrawerPanel => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const exit = useDrawerExit({ isOpen, layoutMode, cardRef, contentRef });
  const isOverlayOpen = isOpen && layoutMode === 'overlay';
  const mountSnapshot = useCallback(
    (node: HTMLDivElement | null) => {
      if (node !== null && exit.snapshot !== null) {
        mountExitSnapshot({ host: node, snapshot: exit.snapshot });
      }
    },
    [exit.snapshot],
  );

  useEffect(() => {
    const card = cardRef.current;
    if (!isOverlayOpen || isParked || card === null || card.contains(document.activeElement)) {
      return;
    }
    (card.querySelector<HTMLElement>(FOCUSABLE) ?? card).focus({ preventScroll: true });
  }, [isOverlayOpen, isParked]);

  return {
    cardRef,
    contentRef,
    exit,
    isOverlayExit: exit.isExiting && exit.lastMode === 'overlay',
    isPushExit: exit.isExiting && exit.lastMode === 'push',
    mountSnapshot,
  };
};
