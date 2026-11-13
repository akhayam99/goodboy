import { useEffect } from 'react';
import { useAppStore } from '../../../store';

type Params = {
  readonly isReload: boolean;
};

export const useBrowserWorkspaceTabs = ({ isReload }: Params): void => {
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  const isLoaded = useAppStore(
    (state) => workspaceId !== null && state.browserTabCounts[workspaceId] !== undefined,
  );
  const isWanted = isReload || !isLoaded;
  useEffect(() => {
    if (workspaceId === null || !isWanted) {
      return;
    }
    void useAppStore.getState().loadBrowserWorkspaceTabs({ workspaceId });
  }, [workspaceId, isWanted]);
};
