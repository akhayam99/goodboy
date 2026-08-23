import { useShallow } from 'zustand/react/shallow';
import type { LinearIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { ConnectForm } from '../components/ConnectForm';
import { IntegrationConnectedRow } from '../components/IntegrationConnectedRow';

type Props = {
  workspaceId: WorkspaceId;
  onConnected?: () => void;
  shouldAutoFocus?: boolean;
};

export const LinearFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const linear = integrations.find((i) => i.provider === 'linear') ?? null;
  const linearConfig = linear ? (linear.config as LinearIntegrationConfig) : null;
  const connectLinear = useAppStore((s) => s.connectLinear);
  const disconnectIntegration = useAppStore((s) => s.disconnectIntegration);

  if (linear != null) {
    return (
      <IntegrationConnectedRow
        provider="linear"
        primary={`Connected as ${linearConfig?.viewerName}`}
        secondary={`linear.app/${linearConfig?.workspaceUrlKey}`}
        disconnectDescription="Unlinks this project from the Linear personal API key. The key stays saved for your other projects."
        onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'linear' })}
      />
    );
  }

  return (
    <ConnectForm
      tokenId="linear-pat"
      tokenLabel="Personal API key"
      tokenPlaceholder="lin_api_…"
      tokenLink={{
        label: 'Get an API key from Linear',
        href: 'https://linear.app/settings/account/security',
      }}
      credentialProvider="linear"
      note={{
        label: 'Where your key goes',
        body: "Read-only scope is enough. The key is stored encrypted in your operating system keychain and sent directly to Linear over HTTPS; it never touches Goodboy's own servers.",
      }}
      shouldAutoFocus={shouldAutoFocus}
      onSubmit={async ({ token, credentialId }) => {
        await connectLinear({ workspaceId, token, credentialId });
        onConnected?.();
      }}
    />
  );
};
