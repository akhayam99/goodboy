import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { BitbucketIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { ConnectForm } from '../components/ConnectForm';
import { IntegrationConnectedRow } from '../components/IntegrationConnectedRow';
import { normalizeWorkspaceSlug } from './normalizeWorkspaceSlug';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onConnected?: () => void;
  readonly shouldAutoFocus?: boolean;
};

const TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';

export const BitbucketFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const integrations = useAppStore(
    useShallow((state) => state.workspaceIntegrations[workspaceId] ?? []),
  );
  const bitbucket =
    integrations.find(
      (integration): integration is BitbucketIntegrationBinding =>
        integration.provider === 'bitbucket',
    ) ?? null;
  const connectBitbucket = useAppStore((state) => state.connectBitbucket);
  const disconnectIntegration = useAppStore((state) => state.disconnectIntegration);

  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [email, setEmail] = useState('');

  const normalizedSlug = normalizeWorkspaceSlug({ input: workspaceSlug });
  const trimmedEmail = email.trim();

  if (bitbucket != null) {
    return (
      <IntegrationConnectedRow
        provider="bitbucket"
        primary={`Connected as ${bitbucket.config.displayName ?? bitbucket.config.email}`}
        secondary={`bitbucket.org/${bitbucket.config.workspaceSlug}`}
        disconnectDescription="Unlinks this project from the Bitbucket personal API key. The key stays saved for your other projects."
        onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'bitbucket' })}
      />
    );
  }

  return (
    <ConnectForm
      tokenId="bitbucket-token"
      tokenLabel="Personal API key"
      tokenPlaceholder="ATATT…"
      tokenLink={{ label: 'Get an API token from Atlassian', href: TOKEN_URL }}
      credentialProvider="bitbucket"
      config={{
        presentation: 'after-token',
        fields: [
          {
            id: 'bitbucket-workspace',
            label: 'Workspace slug',
            placeholder: 'your-team',
            hint: 'The segment right after bitbucket.org in a repository url. Pasting a full url works too.',
            value: workspaceSlug,
            onValueChange: setWorkspaceSlug,
          },
          {
            id: 'bitbucket-email',
            label: 'Account email',
            placeholder: 'you@your-team.com',
            type: 'email',
            value: email,
            onValueChange: setEmail,
          },
        ],
      }}
      isConfigComplete={normalizedSlug !== '' && trimmedEmail !== ''}
      note={{
        label: 'Bitbucket Cloud only',
        body: "Data Center and Server are not supported; an older app password works in the same field. The secret carries your own Bitbucket permissions, is stored encrypted in your operating system keychain, and is sent directly to Bitbucket over HTTPS; it never touches Goodboy's own servers.",
      }}
      shouldAutoFocus={shouldAutoFocus}
      onCredentialSelect={(credential) => {
        if (credential !== null && credential.account !== '') {
          setEmail(credential.account);
        }
      }}
      onSubmit={async ({ token, credentialId }) => {
        await connectBitbucket({
          workspaceId,
          workspaceSlug: normalizedSlug,
          email: trimmedEmail,
          apiToken: token,
          credentialId,
        });
        onConnected?.();
      }}
    />
  );
};
