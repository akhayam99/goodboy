import { useCallback, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export type ConnectionsRefresh = {
  readonly refresh: () => void;
  readonly isRefreshing: boolean;
  readonly error: string | null;
};

export const useConnectionsRefresh = ({ workspaceId }: Params): ConnectionsRefresh => {
  const refreshProviders = useAppStore((state) => state.refreshProviders);
  const checkTools = useAppStore((state) => state.checkTools);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    Promise.all([
      refreshProviders({ isFresh: true }),
      workspaceId === null ? Promise.resolve() : checkTools({ workspaceId, isForced: true }),
    ]).then(
      () => {
        setError(null);
        setIsRefreshing(false);
      },
      (reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
        setIsRefreshing(false);
      },
    );
  }, [refreshProviders, checkTools, workspaceId]);

  return { refresh, isRefreshing, error };
};
