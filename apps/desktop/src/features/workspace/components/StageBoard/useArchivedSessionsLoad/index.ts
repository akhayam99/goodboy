import { useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly isReady: boolean;
};

export const useArchivedSessionsLoad = ({ workspaceId, isReady }: Params): void => {
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    void loadArchivedSessions({ workspaceId });
    const onFocus = () => void loadArchivedSessions({ workspaceId, isForced: true });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isReady, loadArchivedSessions, workspaceId]);
};
