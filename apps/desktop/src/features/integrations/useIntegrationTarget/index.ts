import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { IntegrationActionTarget } from '../../actions/types';
import type { IntegrationGlyphProvider } from '../../../shared/components/IntegrationGlyph';
import { requestCredentialRecheck } from '../credentials';
import type { GithubConnection } from '../github/useGithubConnection';
import { integrationTargetOf } from '../integrationTargetOf';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly provider: IntegrationGlyphProvider;
  readonly isConnected: boolean;
  readonly github: GithubConnection;
};

export const useIntegrationTarget = ({
  workspaceId,
  provider,
  isConnected,
  github,
}: Params): IntegrationActionTarget => {
  const disconnectIntegration = useAppStore((state) => state.disconnectIntegration);
  const refreshGithubStatus = useAppStore((state) => state.refreshGithubStatus);
  const refreshGithub = github.refresh;

  return useMemo(
    () =>
      integrationTargetOf({
        workspaceId,
        provider,
        isConnected,
        onCheck: async () => {
          if (provider !== 'github') {
            requestCredentialRecheck();
            return;
          }
          await refreshGithubStatus();
          refreshGithub();
        },
        onDisconnect: async () => {
          if (provider === 'github') {
            return;
          }
          await disconnectIntegration({ workspaceId, provider });
        },
      }),
    [workspaceId, provider, isConnected, disconnectIntegration, refreshGithubStatus, refreshGithub],
  );
};
