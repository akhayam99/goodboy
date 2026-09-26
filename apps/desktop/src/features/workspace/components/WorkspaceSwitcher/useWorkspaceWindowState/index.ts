import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

export type WorkspaceWindowState = 'current' | 'other-window' | 'closed';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useWorkspaceWindowState = ({ workspaceId }: Params): WorkspaceWindowState => {
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId);
  const presence = useAppStore((state) => state.windowPresence);
  return useMemo(() => {
    if (currentWorkspaceId === workspaceId) {
      return 'current';
    }
    const shownElsewhere = Object.values(presence).some((id) => id === workspaceId);
    return shownElsewhere ? 'other-window' : 'closed';
  }, [currentWorkspaceId, presence, workspaceId]);
};
