import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { connectedToolsOf } from '../../../integrations/connectedToolsOf';
import { connectionGroups, type ConnectionGroups } from '../../model/connectionGroups';
import { workspaceBindingsOf } from '../../model/workspaceBindingsOf';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export const useConnectionGroups = ({ workspaceId }: Params): ConnectionGroups => {
  const providers = useAppStore((state) => state.providers);
  const integrations = useAppStore((state) =>
    workspaceId === null ? undefined : state.workspaceIntegrations[workspaceId],
  );
  const workspaceGithub = useAppStore((state) =>
    workspaceId === null ? undefined : state.githubWorkspaceStatus[workspaceId],
  );
  const globalGithub = useAppStore((state) => state.githubStatus);

  return useMemo(
    () =>
      connectionGroups({
        providers,
        connectedTools:
          workspaceId === null
            ? null
            : connectedToolsOf({
                integrations: workspaceBindingsOf({ integrations: integrations ?? [] }),
                githubStatuses: [workspaceGithub, globalGithub],
              }),
      }),
    [providers, workspaceId, integrations, workspaceGithub, globalGithub],
  );
};
