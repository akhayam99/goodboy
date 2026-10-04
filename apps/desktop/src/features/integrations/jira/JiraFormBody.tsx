import { useShallow } from 'zustand/react/shallow';
import type { JiraIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { IntegrationConnectedRow } from '../components/IntegrationConnectedRow';
import { JiraConnectSteps } from './JiraConnectSteps';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onConnected?: () => void;
  readonly shouldAutoFocus?: boolean;
};

export const JiraFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const integrations = useAppStore(
    useShallow((state) => state.workspaceIntegrations[workspaceId] ?? []),
  );
  const jira =
    integrations.find(
      (integration): integration is JiraIntegrationBinding => integration.provider === 'jira',
    ) ?? null;
  const disconnectIntegration = useAppStore((state) => state.disconnectIntegration);

  if (jira != null) {
    return (
      <IntegrationConnectedRow
        provider="jira"
        credentialId={jira?.credentialId ?? null}
        primary={`Connected as ${jira.config.displayName ?? jira.config.email}`}
        secondary={`${jira.config.siteUrl} (${jira.config.projectKey})`}
        disconnectDescription="Disconnects this workspace from the Jira personal API key. The key stays saved for your other workspaces."
        onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'jira' })}
      />
    );
  }

  return (
    <JiraConnectSteps
      workspaceId={workspaceId}
      shouldAutoFocus={shouldAutoFocus}
      onConnected={onConnected}
    />
  );
};
