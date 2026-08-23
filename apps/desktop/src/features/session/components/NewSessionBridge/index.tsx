import { useEffect, useRef } from 'react';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';

export const NewSessionBridge = () => {
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);
  const hasProjects = useAppStore(
    (s) =>
      s.currentWorkspaceId != null &&
      (s.projects ?? []).some((project) => project.workspaceId === s.currentWorkspaceId),
  );
  const createUntitledSession = useAppStore((s) => s.createUntitledSession);
  const { showToast } = useToast();
  const busyRef = useRef(false);

  useEffect(() => {
    const onNewSessionRequest = () => {
      if (currentWorkspaceId == null || busyRef.current) {
        return;
      }
      if (!hasProjects) {
        showToast('info', 'Link a project first, then start a session');
        return;
      }
      busyRef.current = true;
      void createUntitledSession({ workspaceId: currentWorkspaceId })
        .catch((error: unknown) => {
          showToast('error', formatError(error));
        })
        .finally(() => {
          busyRef.current = false;
        });
    };
    window.addEventListener('goodboy:new-session', onNewSessionRequest);
    return () => window.removeEventListener('goodboy:new-session', onNewSessionRequest);
  }, [createUntitledSession, currentWorkspaceId, hasProjects, showToast]);

  return null;
};
