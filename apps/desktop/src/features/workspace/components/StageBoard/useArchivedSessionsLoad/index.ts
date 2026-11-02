import { useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useArchivedSessionsLoad = ({ workspaceId }: Params): void => {
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions);

  useEffect(() => {
    void loadArchivedSessions({ workspaceId });
    const onFocus = () => void loadArchivedSessions({ workspaceId, isForced: true });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadArchivedSessions, workspaceId]);
};
