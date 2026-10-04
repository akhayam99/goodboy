import { useShallow } from 'zustand/react/shallow';
import type { SentryIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { IntegrationConnectedRow } from '../components/IntegrationConnectedRow';
import { SentryConnectSteps } from './SentryConnectSteps';
import { SentryProjectMap } from './SentryProjectMap';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onConnected?: () => void;
  readonly shouldAutoFocus?: boolean;
};

export const SentryFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const sentry = integrations.find((i) => i.provider === 'sentry') ?? null;
  const sentryConfig = (sentry?.config ?? null) as SentryIntegrationConfig | null;
  const disconnectIntegration = useAppStore((s) => s.disconnectIntegration);

  if (sentry != null && sentryConfig != null) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <IntegrationConnectedRow
          provider="sentry"
          credentialId={sentry?.credentialId ?? null}
          primary={`Connected to ${sentryConfig.projectName ?? sentryConfig.project}`}
          secondary={`${sentryConfig.org}/${sentryConfig.project}`}
          disconnectDescription="Disconnects this workspace from the Sentry personal API key. The key stays saved for your other workspaces."
          onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'sentry' })}
        />
        {sentry.credentialId == null ? null : (
          <SentryProjectMap
            workspaceId={workspaceId}
            credentialId={sentry.credentialId}
            org={sentryConfig.org}
          />
        )}
      </div>
    );
  }

  return (
    <SentryConnectSteps
      workspaceId={workspaceId}
      shouldAutoFocus={shouldAutoFocus}
      onConnected={onConnected}
    />
  );
};
