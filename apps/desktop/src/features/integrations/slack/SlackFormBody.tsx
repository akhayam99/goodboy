import { useShallow } from 'zustand/react/shallow';
import type { SlackIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { ConnectForm } from '../components/ConnectForm';
import { IntegrationConnectedRow } from '../components/IntegrationConnectedRow';
import { SlackConnectGuide } from './SlackConnectGuide';
import { buildSlackManifestUrl, SLACK_USER_SCOPES } from './slackAppManifest';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onConnected?: () => void;
  readonly shouldAutoFocus?: boolean;
};

const MANIFEST_URL = buildSlackManifestUrl({ userScopes: SLACK_USER_SCOPES });

export const SlackFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const integrations = useAppStore(
    useShallow((state) => state.workspaceIntegrations[workspaceId] ?? []),
  );
  const slack =
    integrations.find(
      (integration): integration is SlackIntegrationBinding => integration.provider === 'slack',
    ) ?? null;
  const connectSlack = useAppStore((state) => state.connectSlack);
  const disconnectIntegration = useAppStore((state) => state.disconnectIntegration);

  if (slack != null) {
    return (
      <IntegrationConnectedRow
        provider="slack"
        credentialId={slack?.credentialId ?? null}
        primary={`Connected to ${slack.config.teamName}`}
        secondary={`as ${slack.config.botUserName ?? slack.config.botUserId}`}
        disconnectDescription="Unlinks this project from the Slack token. The token stays saved for your other projects."
        onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'slack' })}
      />
    );
  }

  return (
    <ConnectForm
      tokenId="slack-token"
      tokenLabel="User token"
      tokenPlaceholder="xoxp-…"
      credentialProvider="slack"
      guide={<SlackConnectGuide manifestUrl={MANIFEST_URL} />}
      note={{
        label: 'What Goodboy does with the token',
        body: (
          <div className="flex min-w-0 flex-col gap-2">
            <p>
              Goodboy reads the public channels you have joined; private channels and direct
              messages stay out. Replies and reactions go out under your own name. The token is
              checked against Slack over HTTPS, then kept encrypted in your OS keychain; it never
              touches Goodboy&apos;s own servers.
            </p>
            <p>It asks Slack for these five scopes, granted as User Token Scopes:</p>
            <ul className="flex min-w-0 flex-wrap gap-1.5">
              {SLACK_USER_SCOPES.map((scope) => (
                <li
                  key={scope}
                  className="rounded-full border border-border-soft px-2 py-0.5 font-mono text-2xs text-foreground"
                >
                  {scope}
                </li>
              ))}
            </ul>
          </div>
        ),
      }}
      shouldAutoFocus={shouldAutoFocus}
      onSubmit={async ({ token, credentialId }) => {
        await connectSlack({ workspaceId, botToken: token, credentialId });
        onConnected?.();
      }}
    />
  );
};
