import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SentryIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { ConnectForm } from '../components/ConnectForm';
import { IntegrationConnectedRow } from '../components/IntegrationConnectedRow';

type Props = {
  workspaceId: WorkspaceId;
  onConnected?: () => void;
  shouldAutoFocus?: boolean;
};

export const SentryFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const sentry = integrations.find((i) => i.provider === 'sentry') ?? null;
  const sentryConfig = (sentry?.config ?? null) as SentryIntegrationConfig | null;
  const connectSentry = useAppStore((s) => s.connectSentry);
  const disconnectIntegration = useAppStore((s) => s.disconnectIntegration);

  const [org, setOrg] = useState('');
  const [project, setProject] = useState('');

  if (sentry != null && sentryConfig != null) {
    return (
      <IntegrationConnectedRow
        provider="sentry"
        credentialId={sentry?.credentialId ?? null}
        primary={`Connected to ${sentryConfig.projectName ?? sentryConfig.project}`}
        secondary={`${sentryConfig.org}/${sentryConfig.project}`}
        disconnectDescription="Unlinks this project from the Sentry personal API key. The key stays saved for your other projects."
        onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'sentry' })}
      />
    );
  }

  return (
    <ConnectForm
      tokenId="sentry-token"
      tokenLabel="Personal API key"
      tokenPlaceholder="sntryu_…"
      tokenLink={{
        label: 'Get a user auth token from Sentry',
        href: 'https://sentry.io/settings/account/api/auth-tokens/',
      }}
      credentialProvider="sentry"
      config={{
        presentation: 'after-token',
        fields: [
          {
            id: 'sentry-org',
            label: 'Organization slug',
            placeholder: 'my-org',
            value: org,
            onValueChange: setOrg,
          },
          {
            id: 'sentry-project',
            label: 'Project slug',
            placeholder: 'my-project',
            value: project,
            onValueChange: setProject,
          },
        ],
      }}
      isConfigComplete={org.trim() !== '' && project.trim() !== ''}
      note={{
        label: 'Where your key goes',
        body: "A key with issue read scope is enough. It is stored encrypted in your operating system keychain and sent directly to Sentry over HTTPS; it never touches Goodboy's own servers.",
      }}
      shouldAutoFocus={shouldAutoFocus}
      onSubmit={async ({ token, credentialId }) => {
        await connectSentry({
          workspaceId,
          token,
          org: org.trim(),
          project: project.trim(),
          credentialId,
        });
        setOrg('');
        setProject('');
        onConnected?.();
      }}
    />
  );
};
