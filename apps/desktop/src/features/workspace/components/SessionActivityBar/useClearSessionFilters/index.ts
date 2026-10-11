import { useCallback } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useClearSessionFilters = ({ workspaceId }: Params) => {
  const setSessionViewPrefs = useAppStore((state) => state.setSessionViewPrefs);
  const setSelectedProjectIds = useAppStore((state) => state.setSelectedProjectIds);
  return useCallback(() => {
    setSessionViewPrefs({ workspaceId, patch: { statusFilter: [] } });
    setSelectedProjectIds({ workspaceId, selectedProjectIds: [] });
  }, [setSelectedProjectIds, setSessionViewPrefs, workspaceId]);
};
