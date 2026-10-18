import { useShallow } from 'zustand/react/shallow';
import type { LinearIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { IntegrationConnectedRow } from '../components/IntegrationConnectedRow';
import { disconnectDescriptionOf } from '../disconnectDescriptionOf';
import { LinearConnectSteps } from './LinearConnectSteps';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onConnected?: () => void;
  readonly shouldAutoFocus?: boolean;
  readonly hasHeaderDisconnect?: boolean;
};

export const LinearFormBody = ({
  workspaceId,
  onConnected,
  shouldAutoFocus = false,
  hasHeaderDisconnect = false,
}: Props) => {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const linear = integrations.find((i) => i.provider === 'linear') ?? null;
  const linearConfig = linear ? (linear.config as LinearIntegrationConfig) : null;
  const disconnectIntegration = useAppStore((s) => s.disconnectIntegration);

  if (linear != null) {
    return (
      <IntegrationConnectedRow
        provider="linear"
        credentialId={linear?.credentialId ?? null}
        primary={`Connected as ${linearConfig?.viewerName}`}
        secondary={`linear.app/${linearConfig?.workspaceUrlKey}`}
        disconnectDescription={disconnectDescriptionOf({ provider: 'linear' })}
        hasHeaderDisconnect={hasHeaderDisconnect}
        onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'linear' })}
      />
    );
  }

  return (
    <LinearConnectSteps
      workspaceId={workspaceId}
      shouldAutoFocus={shouldAutoFocus}
      onConnected={onConnected}
    />
  );
};
