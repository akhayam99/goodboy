import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { liveTextRegistry } from '../liveTextRegistry';
import { revealPacer } from '../revealPacer';
import type { RevealPiece } from '../revealPacer';

type Params = {
  readonly runId: string;
  readonly itemKey: string;
  readonly text: string;
  readonly isComplete: boolean;
};

type RevealedText = {
  readonly text: string;
  readonly pieces: ReadonlyArray<RevealPiece>;
  readonly isRevealing: boolean;
  readonly revealKey: string;
  readonly finish: () => void;
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const NO_PIECES: ReadonlyArray<RevealPiece> = [];

const readReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

type ListenerParams = {
  readonly listener: () => void;
};

const subscribeReducedMotion = ({ listener }: ListenerParams): (() => void) => {
  if (typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};

export const useRevealedText = ({ runId, itemKey, text, isComplete }: Params): RevealedText => {
  const key = `${runId}:${itemKey}`;
  const isReduced = useSyncExternalStore(
    (listener) => subscribeReducedMotion({ listener }),
    readReducedMotion,
    () => false,
  );
  const [isLiveMount] = useState(
    () => !isReduced && text.length > 0 && liveTextRegistry.isLive({ runId }),
  );
  const [isBroken, setIsBroken] = useState(false);
  const baseline = useRef<number | null>(null);
  const subscribe = useCallback(
    (listener: () => void) => revealPacer.subscribe({ key, listener }),
    [key],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    () => revealPacer.snapshotOf({ key }),
    () => null,
  );

  useLayoutEffect(() => {
    if (isReduced || isBroken) {
      revealPacer.release({ key });
      return;
    }
    try {
      const previous = baseline.current;
      baseline.current = text.length;
      if (revealPacer.snapshotOf({ key }) !== null) {
        revealPacer.track({ key, text, isComplete, startCut: 0 });
        return;
      }
      if (previous === null) {
        if (isLiveMount) {
          revealPacer.track({ key, text, isComplete, startCut: 0 });
        }
        return;
      }
      if (text.length > previous && liveTextRegistry.isLive({ runId })) {
        revealPacer.track({ key, text, isComplete, startCut: previous });
      }
    } catch {
      revealPacer.release({ key });
      setIsBroken(true);
    }
  }, [key, runId, text, isComplete, isReduced, isBroken, isLiveMount]);

  useLayoutEffect(
    () => () => {
      revealPacer.release({ key });
      baseline.current = null;
    },
    [key],
  );

  const finish = useCallback(() => revealPacer.flush({ key }), [key]);

  if (isReduced || isBroken) {
    return { text, pieces: NO_PIECES, isRevealing: false, revealKey: key, finish };
  }
  if (snapshot === null) {
    return {
      text: isLiveMount ? '' : text,
      pieces: NO_PIECES,
      isRevealing: isLiveMount,
      revealKey: key,
      finish,
    };
  }
  return {
    text: text.slice(0, Math.min(snapshot.cut, text.length)),
    pieces: snapshot.pieces,
    isRevealing: snapshot.isRevealing,
    revealKey: key,
    finish,
  };
};
