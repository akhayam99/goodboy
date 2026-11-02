import { useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { foldAutoLimitOfWorkspace } from '../../foldAutoLimitOfWorkspace';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export const useFoldAutoLimit = ({ workspaceId }: Params): void => {
  const reportError = useAppStore((state) => state.reportError);
  const isLoaded = useAppStore(
    (state) => workspaceId !== null && state.workspaceOverrides[workspaceId] !== undefined,
  );

  useEffect(() => {
    if (workspaceId === null || !isLoaded) {
      return;
    }
    foldAutoLimitOfWorkspace({ workspaceId }).catch((error: unknown) => {
      void reportError({
        title: "Couldn't move the Auto limit into the run defaults",
        error,
        workspaceId,
      });
    });
  }, [workspaceId, isLoaded, reportError]);
};
