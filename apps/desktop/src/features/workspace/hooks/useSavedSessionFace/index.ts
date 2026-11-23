import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore, type SessionFace } from '../../../../store';

type Params = {
  readonly sessionId: SessionId;
};

let focusCount = 0;
let isCountingFocus = false;
const readAtFocus = new Map<SessionId, number>();

const countFocus = (): void => {
  if (isCountingFocus || typeof window === 'undefined') {
    return;
  }
  isCountingFocus = true;
  window.addEventListener('focus', () => {
    focusCount += 1;
  });
};

export const useSavedSessionFace = ({ sessionId }: Params): SessionFace | null => {
  const face = useAppStore((state) => state.sessionFace[sessionId]);
  const recallSessionFace = useAppStore((state) => state.recallSessionFace);
  const isKnown = face !== undefined;
  useEffect(() => {
    countFocus();
    const read = (): void => {
      readAtFocus.set(sessionId, focusCount);
      void recallSessionFace({ sessionId });
    };
    const isCurrent = (): boolean => useAppStore.getState().currentSessionId === sessionId;
    const isStale = (readAtFocus.get(sessionId) ?? 0) < focusCount;
    if (!isKnown || (isStale && !isCurrent())) {
      read();
    }
    const rereadOnFocus = (): void => {
      if (isCurrent()) {
        return;
      }
      read();
    };
    window.addEventListener('focus', rereadOnFocus);
    return () => window.removeEventListener('focus', rereadOnFocus);
  }, [isKnown, recallSessionFace, sessionId]);
  return face ?? null;
};
