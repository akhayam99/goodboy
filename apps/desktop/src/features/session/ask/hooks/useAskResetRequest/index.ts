import { useEffect, useRef } from 'react';
import type { SessionId } from '@goodboy/types';
import { ASK_RESET_EVENT } from '../../ASK_RESET_EVENT';

type Params = {
  readonly sessionId: SessionId;
  readonly onReset: () => void;
};

export const useAskResetRequest = ({ sessionId, onReset }: Params): void => {
  const resetRef = useRef(onReset);
  resetRef.current = onReset;

  useEffect(() => {
    const listener = (event: Event) => {
      if (event instanceof CustomEvent && event.detail === sessionId) {
        resetRef.current();
      }
    };
    window.addEventListener(ASK_RESET_EVENT, listener);
    return () => window.removeEventListener(ASK_RESET_EVENT, listener);
  }, [sessionId]);
};
