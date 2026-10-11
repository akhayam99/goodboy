import { useCallback, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectTaskModel } from '../../../../store/slices/models/selectTaskModel';
import { polishWorkflowGuidanceText } from '../../workflows';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly workingDir?: string | null;
};

export const usePolishGuidance = ({ workspaceId, workingDir = null }: Params) => {
  const [isPolishing, setIsPolishing] = useState(false);
  const polish = useCallback(
    async (guidance: string): Promise<string | null> => {
      const deps = selectTaskModel({
        state: useAppStore.getState(),
        workspaceId,
        task: 'prose_polish',
      });
      setIsPolishing(true);
      try {
        return await polishWorkflowGuidanceText({
          deps: { ...deps, ...(workingDir !== null && { workingDir }) },
          guidance,
        });
      } finally {
        setIsPolishing(false);
      }
    },
    [workingDir, workspaceId],
  );
  return { polish, isPolishing };
};
