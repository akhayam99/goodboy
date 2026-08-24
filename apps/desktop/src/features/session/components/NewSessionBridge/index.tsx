import { useEffect, useRef } from 'react';
import { formatError } from '@goodboy/ui';
import type { ProjectId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';

export const NewSessionBridge = () => {
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);
  const projectCount = useAppStore(
    (s) =>
      (s.projects ?? []).filter((project) => project.workspaceId === s.currentWorkspaceId).length,
  );
  const soleProjectId = useAppStore((s): ProjectId | null => {
    const owned = (s.projects ?? []).filter(
      (project) => project.workspaceId === s.currentWorkspaceId,
    );
    return owned.length === 1 ? (owned[0]?.id ?? null) : null;
  });
  const createUntitledSession = useAppStore((s) => s.createUntitledSession);
  const requestSessionProjectPick = useAppStore((s) => s.requestSessionProjectPick);
  const { showToast } = useToast();
  const busyRef = useRef(false);

  useEffect(() => {
    const onNewSessionRequest = () => {
      if (currentWorkspaceId == null || busyRef.current) {
        return;
      }
      if (projectCount === 0) {
        showToast('info', 'Link a project first, then start a session');
        window.dispatchEvent(
          new CustomEvent('goodboy:open-workspace-settings', { detail: { section: 'projects' } }),
        );
        return;
      }
      if (soleProjectId == null) {
        requestSessionProjectPick({ workspaceId: currentWorkspaceId });
        return;
      }
      busyRef.current = true;
      void createUntitledSession({ workspaceId: currentWorkspaceId, projectId: soleProjectId })
        .catch((error: unknown) => {
          showToast('error', formatError(error));
        })
        .finally(() => {
          busyRef.current = false;
        });
    };
    window.addEventListener('goodboy:new-session', onNewSessionRequest);
    return () => window.removeEventListener('goodboy:new-session', onNewSessionRequest);
  }, [
    createUntitledSession,
    currentWorkspaceId,
    projectCount,
    requestSessionProjectPick,
    showToast,
    soleProjectId,
  ]);

  return null;
};
