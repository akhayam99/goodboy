import { useEffect, useState, type RefObject } from 'react';
import { canAnimate } from '../canAnimate';
import { DRAWER_EXIT_MS, type DrawerMode } from '../drawerGeometry';
import { exitSnapshotOf, type ExitSnapshot } from '../exitSnapshot';
import { FOLD_MS } from '../motionTimings';

type OpenMode = Exclude<DrawerMode, 'closed'>;

type Phase = 'closed' | 'open' | 'exiting';

type ExitState = {
  readonly phase: Phase;
  readonly last: OpenMode | null;
  readonly isResumed: boolean;
  readonly snapshot: ExitSnapshot | null;
};

export type DrawerExit = {
  readonly isExiting: boolean;
  readonly lastMode: OpenMode | null;
  readonly isResumed: boolean;
  readonly snapshot: ExitSnapshot | null;
};

type Params = {
  readonly isOpen: boolean;
  readonly layoutMode: OpenMode;
  readonly cardRef: RefObject<HTMLElement | null>;
  readonly contentRef: RefObject<HTMLElement | null>;
};

type NextParams = Params & {
  readonly state: ExitState;
};

type CaptureParams = Pick<Params, 'cardRef' | 'contentRef'> & {
  readonly last: OpenMode | null;
};

const CLOSED: ExitState = { phase: 'closed', last: null, isResumed: false, snapshot: null };

const captureOf = ({ cardRef, contentRef, last }: CaptureParams): ExitSnapshot | null => {
  if (last === 'push' && !canAnimate({ element: cardRef.current })) {
    return null;
  }
  return exitSnapshotOf({ element: contentRef.current });
};

const nextOf = ({ state, isOpen, layoutMode, cardRef, contentRef }: NextParams): ExitState => {
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
  const snapshot = captureOf({ cardRef, contentRef, last: state.last });
  if (snapshot === null) {
    return { phase: 'closed', last: state.last, isResumed: false, snapshot: null };
  }
  return { phase: 'exiting', last: state.last, isResumed: false, snapshot };
};

export const useDrawerExit = ({ isOpen, layoutMode, cardRef, contentRef }: Params): DrawerExit => {
  const [state, setState] = useState<ExitState>(CLOSED);
  const next = nextOf({ state, isOpen, layoutMode, cardRef, contentRef });
  if (next !== state) {
    setState(next);
  }
  const isExiting = next.phase === 'exiting';
  const exitMs = next.last === 'push' ? FOLD_MS : DRAWER_EXIT_MS;

  useEffect(() => {
    if (!isExiting) {
      return;
    }
    const timer = setTimeout(() => {
      setState((current) =>
        current.phase === 'exiting' ? { ...current, phase: 'closed', snapshot: null } : current,
      );
    }, exitMs);
    return () => clearTimeout(timer);
  }, [isExiting, exitMs]);

  return {
    isExiting,
    lastMode: next.last,
    isResumed: next.isResumed,
    snapshot: next.snapshot,
  };
};
