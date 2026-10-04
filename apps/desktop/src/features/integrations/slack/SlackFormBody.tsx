import { useShallow } from 'zustand/react/shallow';
import type { SlackIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { ConnectForm } from '../components/ConnectForm';
import { SlackConnectGuide } from './SlackConnectGuide';
import { buildSlackManifestUrl, SLACK_USER_SCOPES } from './slackAppManifest';
import { SlackSettings } from './SlackSettings';

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

  if (slack != null) {
    return <SlackSettings workspaceId={workspaceId} slack={slack} />;
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
            <ul className="flex min-w-0 flex-wrap gap-2">
              {SLACK_USER_SCOPES.map((scope) => (
                <li
                  key={scope}
                  className="rounded-full border border-border-soft px-2 py-0.5 font-mono text-chip text-foreground"
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
        if (credentialId === null && token.startsWith('xoxb-')) {
          throw new Error(
            'This is a bot token. Goodboy needs your user token, the one that starts with xoxp-.',
          );
        }
        await connectSlack({ workspaceId, userToken: token, credentialId });
        onConnected?.();
      }}
    />
  );
};
