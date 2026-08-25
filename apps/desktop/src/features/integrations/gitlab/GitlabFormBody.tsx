import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GitlabIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { ConnectForm } from '../components/ConnectForm';
import { IntegrationConnectedRow } from '../components/IntegrationConnectedRow';

type Props = {
  workspaceId: WorkspaceId;
  onConnected?: () => void;
  shouldAutoFocus?: boolean;
};

const DEFAULT_HOST = 'https://gitlab.com';

function normalizeHost(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (trimmed === '') {
    return DEFAULT_HOST;
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return DEFAULT_HOST;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_HOST;
  }
}

export const GitlabFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const gitlab =
    integrations.find((i): i is GitlabIntegrationBinding => i.provider === 'gitlab') ?? null;
  const config = gitlab ? gitlab.config : null;
  const connectGitlab = useAppStore((s) => s.connectGitlab);
  const disconnectIntegration = useAppStore((s) => s.disconnectIntegration);

  const [host, setHost] = useState(DEFAULT_HOST);

  if (gitlab != null && config != null) {
    return (
      <IntegrationConnectedRow
        provider="gitlab"
        credentialId={gitlab?.credentialId ?? null}
        primary={`Connected as ${config.userName}`}
        secondary={config.host}
        disconnectDescription="Unlinks this project from the GitLab personal API key. The key stays saved for your other projects."
        onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'gitlab' })}
      />
    );
  }

  return (
    <ConnectForm
      tokenId="gitlab-pat"
      tokenLabel="Personal API key"
      tokenPlaceholder="glpat-…"
      tokenLink={{
        label: 'Get a personal access token from GitLab',
        href: `${normalizeHost(host)}/-/profile/personal_access_tokens`,
      }}
      credentialProvider="gitlab"
      config={{
        presentation: 'disclosure',
        disclosureLabel: 'Self-hosted GitLab',
        fields: [
          {
            id: 'gitlab-host',
            label: 'Host',
            placeholder: DEFAULT_HOST,
            value: host,
            onValueChange: setHost,
          },
        ],
      }}
      note={{
        label: 'Where your key goes',
        body: "The read_api scope is enough. The key is stored encrypted in your operating system keychain and sent directly to GitLab over HTTPS; it never touches Goodboy's own servers.",
      }}
      shouldAutoFocus={shouldAutoFocus}
      onCredentialSelect={(credential) => {
        if (credential !== null && credential.account !== '') {
          setHost(credential.account);
        }
      }}
      onSubmit={async ({ token, credentialId }) => {
        await connectGitlab({ workspaceId, host: normalizeHost(host), token, credentialId });
        onConnected?.();
      }}
    />
  );
};
