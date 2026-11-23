import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore, type SessionFace } from '../../../../store';

type Params = {
  readonly sessionId: SessionId;
};

export const useSavedSessionFace = ({ sessionId }: Params): SessionFace | null => {
  const face = useAppStore((state) => state.sessionFace[sessionId]);
  const recallSessionFace = useAppStore((state) => state.recallSessionFace);
  const isKnown = face !== undefined;
  useEffect(() => {
    if (isKnown) {
      return;
    }
    void recallSessionFace({ sessionId });
  }, [isKnown, recallSessionFace, sessionId]);
  return face ?? null;
};
