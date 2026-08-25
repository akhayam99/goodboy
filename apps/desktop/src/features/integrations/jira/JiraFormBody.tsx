import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { JiraIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { ConnectForm } from '../components/ConnectForm';
import { IntegrationConnectedRow } from '../components/IntegrationConnectedRow';
import { normalizeSiteUrl } from './normalizeSiteUrl';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onConnected?: () => void;
  readonly shouldAutoFocus?: boolean;
};

const TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';

export const JiraFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const integrations = useAppStore(
    useShallow((state) => state.workspaceIntegrations[workspaceId] ?? []),
  );
  const jira =
    integrations.find(
      (integration): integration is JiraIntegrationBinding => integration.provider === 'jira',
    ) ?? null;
  const connectJira = useAppStore((state) => state.connectJira);
  const disconnectIntegration = useAppStore((state) => state.disconnectIntegration);

  const [siteUrl, setSiteUrl] = useState('');
  const [email, setEmail] = useState('');
  const [projectKey, setProjectKey] = useState('');

  const normalizedSiteUrl = normalizeSiteUrl({ input: siteUrl });
  const trimmedEmail = email.trim();
  const trimmedProjectKey = projectKey.trim().toUpperCase();

  if (jira != null) {
    return (
      <IntegrationConnectedRow
        provider="jira"
        credentialId={jira?.credentialId ?? null}
        primary={`Connected as ${jira.config.displayName ?? jira.config.email}`}
        secondary={`${jira.config.siteUrl} (${jira.config.projectKey})`}
        disconnectDescription="Unlinks this project from the Jira personal API key. The key stays saved for your other projects."
        onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'jira' })}
      />
    );
  }

  return (
    <ConnectForm
      tokenId="jira-token"
      tokenLabel="Personal API key"
      tokenPlaceholder="ATATT…"
      tokenLink={{ label: 'Get an API token from Atlassian', href: TOKEN_URL }}
      credentialProvider="jira"
      config={{
        presentation: 'after-token',
        fields: [
          {
            id: 'jira-site',
            label: 'Site URL',
            placeholder: 'https://your-team.atlassian.net',
            value: siteUrl,
            onValueChange: setSiteUrl,
          },
          {
            id: 'jira-email',
            label: 'Account email',
            placeholder: 'you@your-team.com',
            type: 'email',
            value: email,
            onValueChange: setEmail,
          },
          {
            id: 'jira-project',
            label: 'Project key',
            placeholder: 'ENG',
            autoCapitalize: 'characters',
            hint: 'The prefix on every issue key, the ENG in ENG-142.',
            value: projectKey,
            onValueChange: setProjectKey,
          },
        ],
      }}
      isConfigComplete={normalizedSiteUrl !== '' && trimmedEmail !== '' && trimmedProjectKey !== ''}
      note={{
        label: 'Jira Cloud only',
        body: "Data Center and Server are not supported. The key carries your own Jira permissions, is stored encrypted in your operating system keychain, and is sent directly to Jira over HTTPS; it never touches Goodboy's own servers.",
      }}
      shouldAutoFocus={shouldAutoFocus}
      onCredentialSelect={(credential) => {
        if (credential !== null && credential.account !== '') {
          setEmail(credential.account);
        }
      }}
      onSubmit={async ({ token, credentialId }) => {
        await connectJira({
          workspaceId,
          siteUrl: normalizedSiteUrl,
          email: trimmedEmail,
          projectKey: trimmedProjectKey,
          apiToken: token,
          credentialId,
        });
        onConnected?.();
      }}
    />
  );
};
