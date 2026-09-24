import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../../store';

export const NewSessionBridge = () => {
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);
  const createUntitledSession = useAppStore((s) => s.createUntitledSession);
  const reportError = useAppStore((s) => s.reportError);
  const busyRef = useRef(false);

  useEffect(() => {
    const onNewSessionRequest = () => {
      if (currentWorkspaceId == null || busyRef.current) {
        return;
      }
      busyRef.current = true;
      void createUntitledSession({ workspaceId: currentWorkspaceId })
        .catch((error: unknown) =>
          reportError({
            title: "Couldn't start a new session",
            error,
            workspaceId: currentWorkspaceId,
          }),
        )
        .finally(() => {
          busyRef.current = false;
        });
    };
    window.addEventListener('goodboy:new-session', onNewSessionRequest);
    return () => window.removeEventListener('goodboy:new-session', onNewSessionRequest);
  }, [createUntitledSession, currentWorkspaceId, reportError]);

  return null;
};
