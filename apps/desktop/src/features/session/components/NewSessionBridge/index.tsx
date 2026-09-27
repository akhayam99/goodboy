import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../../store';

export const NewSessionBridge = () => {
  const startBlankSession = useAppStore((s) => s.startBlankSession);
  const reportError = useAppStore((s) => s.reportError);
  const isStartingRef = useRef(false);

  useEffect(() => {
    const onNewSessionRequest = () => {
      if (isStartingRef.current) {
        return;
      }
      isStartingRef.current = true;
      void startBlankSession()
        .catch((error: unknown) =>
          reportError({ severity: 'error', title: "Couldn't create the session", error }),
        )
        .finally(() => {
          isStartingRef.current = false;
        });
    };
    window.addEventListener('goodboy:new-session', onNewSessionRequest);
    return () => window.removeEventListener('goodboy:new-session', onNewSessionRequest);
  }, [reportError, startBlankSession]);

  return null;
};
