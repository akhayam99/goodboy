import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { IntegrationActionTarget } from '../../actions/types';
import { integrationLabel, type IntegrationGlyphProvider } from '../components/IntegrationGlyph';
import { requestCredentialRecheck } from '../credentials';
import { disconnectDescriptionOf } from '../disconnectDescriptionOf';
import type { GithubConnection } from '../github/useGithubConnection';

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

  return useMemo((): IntegrationActionTarget => {
    if (!isConnected) {
      return {
        kind: 'integration',
        facts: {
          label: integrationLabel({ provider }),
          disconnectDescription: '',
          onOpenTasks: null,
          onCheck: null,
          onDisconnect: null,
        },
      };
    }
    const onOpenTasks = () =>
      window.dispatchEvent(new CustomEvent('goodboy:open-inbox', { detail: { provider } }));
    if (provider === 'github') {
      return {
        kind: 'integration',
        facts: {
          label: integrationLabel({ provider }),
          disconnectDescription: '',
          onOpenTasks,
          onCheck: async () => {
            await refreshGithubStatus();
            refreshGithub();
          },
          onDisconnect: null,
        },
      };
    }
    return {
      kind: 'integration',
      facts: {
        label: integrationLabel({ provider }),
        disconnectDescription: disconnectDescriptionOf({ provider }),
        onOpenTasks,
        onCheck: async () => {
          requestCredentialRecheck();
        },
        onDisconnect: () => disconnectIntegration({ workspaceId, provider }),
      },
    };
  }, [
    workspaceId,
    provider,
    isConnected,
    disconnectIntegration,
    refreshGithubStatus,
    refreshGithub,
  ]);
};
