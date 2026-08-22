import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  IntegrationCredentialId,
  SlackWorkspaceIntegration,
  WorkspaceId,
} from '@goodboy/types';
import { Button, formatError, InlineConfirm, Input } from '@goodboy/ui';
import { CheckCircle2, Unplug } from 'lucide-react';
import { useAppStore } from '../../../store';
import { IntegrationCredentialPicker } from '../components/IntegrationCredentialPicker';
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
      (integration): integration is SlackWorkspaceIntegration => integration.provider === 'slack',
    ) ?? null;
  const connectSlack = useAppStore((state) => state.connectSlack);
  const disconnectIntegration = useAppStore((state) => state.disconnectIntegration);

  const [botToken, setBotToken] = useState('');
  const [credentialId, setCredentialId] = useState<IntegrationCredentialId | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnectArmed, setIsDisconnectArmed] = useState(false);

  const trimmedToken = botToken.trim();
  const canConnect = credentialId !== null || trimmedToken !== '';

  const onConnect = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await connectSlack({ workspaceId, botToken: trimmedToken, credentialId });
      setBotToken('');
      onConnected?.();
    } catch (connectError) {
      setError(formatError(connectError));
    } finally {
      setIsBusy(false);
    }
  };

  const onDisconnect = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await disconnectIntegration({ workspaceId, provider: 'slack' });
    } catch (disconnectError) {
      setError(formatError(disconnectError));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {slack != null ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 size={14} aria-hidden className="text-success" />
            Connected to {slack.config.teamName}
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
            <dt className="text-muted-foreground">team</dt>
            <dd className="font-mono text-foreground">{slack.config.teamId}</dd>
            <dt className="text-muted-foreground">connected as</dt>
            <dd className="font-mono text-foreground">
              {slack.config.botUserName ?? slack.config.botUserId}
            </dd>
          </dl>
          {isDisconnectArmed ? (
            <InlineConfirm
              role="danger"
              icon={<Unplug size={12} aria-hidden />}
              title="Disconnect Slack?"
              description="Unlinks this project from the Slack token. The token stays saved for your other projects."
              confirmLabel="Disconnect Slack"
              autoDisarmMs={4000}
              onConfirm={onDisconnect}
              onCancel={() => setIsDisconnectArmed(false)}
            />
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsDisconnectArmed(true)}
              disabled={isBusy}
            >
              <Unplug size={12} aria-hidden />
              Disconnect
            </Button>
          )}
        </div>
      ) : (
        <>
          <IntegrationCredentialPicker
            provider="slack"
            selectedCredentialId={credentialId}
            onSelect={(credential) => setCredentialId(credential?.id ?? null)}
            isDisabled={isBusy}
          />
          {credentialId === null ? (
            <>
              <SlackConnectGuide manifestUrl={MANIFEST_URL} />
              <div className="flex flex-col gap-2">
                <label htmlFor="slack-token" className="text-xs font-semibold text-foreground">
                  User token
                </label>
                <Input
                  id="slack-token"
                  type="password"
                  autoFocus={shouldAutoFocus}
                  placeholder="xoxp-…"
                  value={botToken}
                  onChange={(event) => setBotToken(event.target.value)}
                  disabled={isBusy}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </>
          ) : null}
          <p className="text-2xs leading-relaxed text-muted-foreground">
            Goodboy reads the public channels you have joined and asks Slack for nothing beyond the
            five scopes it needs, so private channels and direct messages stay out. Replies and
            reactions go out under your own name, the way they would if you typed them in Slack.
            Goodboy also pulls your workspace&apos;s full member list, names and avatars, to show
            who posted in a thread. Your token is checked against Slack over HTTPS before anything
            is stored, then kept in your OS keychain, encrypted at rest. It never touches
            Goodboy&apos;s own servers.
          </p>
        </>
      )}

      {error != null ? (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : null}

      {slack == null ? (
        <div className="flex justify-end">
          <Button
            onClick={() => void onConnect()}
            disabled={isBusy || !canConnect}
            className={isBusy ? 'animate-border-pulse' : undefined}
          >
            {isBusy ? 'Verifying…' : 'Connect'}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
