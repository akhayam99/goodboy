import { useEffect, useState, type RefObject } from 'react';
import { DRAWER_EXIT_MS, type DrawerMode } from '../drawerGeometry';

type OpenMode = Exclude<DrawerMode, 'closed'>;

type Phase = 'closed' | 'open' | 'exiting';

type ExitState = {
  readonly phase: Phase;
  readonly last: OpenMode | null;
  readonly isResumed: boolean;
  readonly snapshot: Node | null;
};

export type DrawerExit = {
  readonly isExiting: boolean;
  readonly lastMode: OpenMode | null;
  readonly isResumed: boolean;
  readonly snapshot: Node | null;
};

type Params = {
  readonly isOpen: boolean;
  readonly layoutMode: OpenMode;
  readonly cardRef: RefObject<HTMLElement | null>;
};

type NextParams = Params & {
  readonly state: ExitState;
};

const CLOSED: ExitState = { phase: 'closed', last: null, isResumed: false, snapshot: null };

const snapshotOf = (card: HTMLElement | null): Node | null => {
  if (card === null || card.querySelector('canvas') !== null) {
    return null;
  }
  return card.firstElementChild?.cloneNode(true) ?? null;
};

const nextOf = ({ state, isOpen, layoutMode, cardRef }: NextParams): ExitState => {
  if (isOpen) {
    if (state.phase === 'open' && state.last === layoutMode) {
      return state;
    }
    return {
      phase: 'open',
      last: layoutMode,
      isResumed: state.phase === 'exiting' || (state.phase === 'open' && state.isResumed),
      snapshot: null,
    };
  }
  if (state.phase !== 'open') {
    return state;
  }
  const snapshot = state.last === 'overlay' ? snapshotOf(cardRef.current) : null;
  if (snapshot === null) {
    return { phase: 'closed', last: state.last, isResumed: false, snapshot: null };
  }
  return { phase: 'exiting', last: state.last, isResumed: false, snapshot };
};

export const useDrawerExit = ({ isOpen, layoutMode, cardRef }: Params): DrawerExit => {
  const [state, setState] = useState<ExitState>(CLOSED);
  const next = nextOf({ state, isOpen, layoutMode, cardRef });
  if (next !== state) {
    setState(next);
  }
  const isExiting = next.phase === 'exiting';

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
    lastMode: next.last,
    isResumed: next.isResumed,
    snapshot: next.snapshot,
  };
};
