import { useCallback, useEffect, useState } from 'react';
import type { GhTokenStatus, WorkspaceId } from '@goodboy/types';
import { ghStatus } from '../../github/github';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type ConnectionState = {
  readonly status: GhTokenStatus | null;
  readonly isResolved: boolean;
};

export const useGithubConnection = ({ workspaceId }: Params) => {
  const [connection, setConnection] = useState<ConnectionState>({
    status: null,
    isResolved: false,
  });

  const refresh = useCallback(async () => {
    try {
      const status = await ghStatus(workspaceId);
      setConnection({ status, isResolved: true });
    } catch {
      setConnection({ status: null, isResolved: true });
    }
  }, [workspaceId]);

  useEffect(() => {
    setConnection({ status: null, isResolved: false });
    void refresh();
  }, [refresh]);

  return {
    isAuthenticated: connection.status?.mode !== 'absent' && connection.status != null,
    isResolved: connection.isResolved,
    isScoped: connection.status?.scoped === true,
    refresh,
  };
};
