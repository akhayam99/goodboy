import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { DRAWER_EXIT_MAX_ELEMENTS, DRAWER_EXIT_MS, type DrawerMode } from '../drawerGeometry';

type OpenMode = Exclude<DrawerMode, 'closed'>;

type Phase = 'closed' | 'open' | 'capturing' | 'exiting';

type ExitState = {
  readonly phase: Phase;
  readonly last: OpenMode | null;
  readonly isResumed: boolean;
  readonly snapshot: Node | null;
};

export type DrawerExit = {
  readonly isExiting: boolean;
  readonly isCapturing: boolean;
  readonly lastMode: OpenMode | null;
  readonly isResumed: boolean;
  readonly snapshot: Node | null;
};

type Params = {
  readonly isOpen: boolean;
  readonly layoutMode: OpenMode;
  readonly cardRef: RefObject<HTMLElement | null>;
};

type NextParams = Omit<Params, 'cardRef'> & {
  readonly state: ExitState;
};

const CLOSED: ExitState = { phase: 'closed', last: null, isResumed: false, snapshot: null };

const UNCLONEABLE = 'canvas, iframe, video, audio, webview';

const isHeavy = (card: HTMLElement): boolean => {
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT);
  let count = 0;
  while (walker.nextNode() !== null) {
    count += 1;
    if (count > DRAWER_EXIT_MAX_ELEMENTS) {
      return true;
    }
  }
  return false;
};

const snapshotOf = (card: HTMLElement | null): Node | null => {
  if (card === null || card.querySelector(UNCLONEABLE) !== null || isHeavy(card)) {
    return null;
  }
  return card.firstElementChild?.cloneNode(true) ?? null;
};

const nextOf = ({ state, isOpen, layoutMode }: NextParams): ExitState => {
  if (isOpen) {
    if (state.phase === 'open' && state.last === layoutMode) {
      return state;
    }
    return {
      phase: 'open',
      last: layoutMode,
      isResumed:
        state.phase === 'exiting' ||
        state.phase === 'capturing' ||
        (state.phase === 'open' && state.isResumed),
      snapshot: null,
    };
  }
  if (state.phase !== 'open') {
    return state;
  }
  if (state.last !== 'overlay') {
    return { phase: 'closed', last: state.last, isResumed: false, snapshot: null };
  }
  return { phase: 'capturing', last: state.last, isResumed: false, snapshot: null };
};

export const useDrawerExit = ({ isOpen, layoutMode, cardRef }: Params): DrawerExit => {
  const [state, setState] = useState<ExitState>(CLOSED);
  const next = nextOf({ state, isOpen, layoutMode });
  if (next !== state) {
    setState(next);
  }
  const isExiting = next.phase === 'exiting';
  const isCapturing = next.phase === 'capturing';

  useLayoutEffect(() => {
    if (!isCapturing) {
      return;
    }
    const snapshot = snapshotOf(cardRef.current);
    setState((current) => {
      if (current.phase !== 'capturing') {
        return current;
      }
      if (snapshot === null) {
        return { ...current, phase: 'closed', snapshot: null };
      }
      return { ...current, phase: 'exiting', snapshot };
    });
  }, [isCapturing, cardRef]);

  useEffect(() => {
    if (!isExiting) {
      return;
    }
    const timer = setTimeout(() => {
      setState((current) =>
        current.phase === 'exiting' ? { ...current, phase: 'closed', snapshot: null } : current,
      );
    }, DRAWER_EXIT_MS);
    return () => clearTimeout(timer);
  }, [isExiting]);

  return {
    isExiting,
    isCapturing,
    lastMode: next.last,
    isResumed: next.isResumed,
    snapshot: next.snapshot,
  };
};
