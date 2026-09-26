import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GitlabIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { ConnectForm } from '../components/ConnectForm';
import { IntegrationConnectedRow } from '../components/IntegrationConnectedRow';
import { normalizeHostUrl } from '../shared/normalizeHostUrl';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onConnected?: () => void;
  readonly shouldAutoFocus?: boolean;
};

const DEFAULT_HOST = 'https://gitlab.com';

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
        disconnectDescription="Unlinks this workspace from the GitLab personal API key. The key stays saved for your other workspaces."
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
        href: `${normalizeHostUrl({ input: host, fallback: DEFAULT_HOST })}/-/profile/personal_access_tokens`,
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
        await connectGitlab({
          workspaceId,
          host: normalizeHostUrl({ input: host, fallback: DEFAULT_HOST }),
          token,
          credentialId,
        });
        onConnected?.();
      }}
    />
  );
};
