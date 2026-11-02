import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useSelectedProjectIds, useSessionViewPrefs } from '../../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useBoardMotionKey = ({ workspaceId }: Params): string => {
  const viewPrefs = useSessionViewPrefs(workspaceId);
  const selectedProjectIds = useSelectedProjectIds({ workspaceId });
  return useMemo(
    () => JSON.stringify([workspaceId, viewPrefs, selectedProjectIds]),
    [selectedProjectIds, viewPrefs, workspaceId],
  );
};
