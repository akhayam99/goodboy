import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SlackWorkspaceIntegration, WorkspaceId } from '@goodboy/types';
import { Button, InlineConfirm, Input } from '@goodboy/ui';
import { CheckCircle2, ExternalLink, Unplug } from 'lucide-react';
import { useAppStore } from '../../../store';
import { formatError } from '../../../shared/lib/errors';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onConnected?: () => void;
  readonly shouldAutoFocus?: boolean;
};

const APP_URL = 'https://api.slack.com/apps';

const SCOPES = ['channels:read', 'channels:history', 'users:read', 'chat:write', 'reactions:write'];

export const SlackFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const integrations = useAppStore(
    useShallow((state) => state.workspaceIntegrations[workspaceId] ?? []),
  );
  const slack =
    integrations.find(
      (integration): integration is SlackWorkspaceIntegration => integration.provider === 'slack',
    ) ?? null;
  const connectSlack = useAppStore((state) => state.connectSlack);
  const disconnectSlack = useAppStore((state) => state.disconnectSlack);

  const [botToken, setBotToken] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnectArmed, setIsDisconnectArmed] = useState(false);

  const trimmedToken = botToken.trim();
  const canConnect = trimmedToken !== '';

  const onConnect = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await connectSlack({ workspaceId, botToken: trimmedToken });
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
      await disconnectSlack({ workspaceId });
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
            <dt className="text-muted-foreground">bot user</dt>
            <dd className="font-mono text-foreground">
              {slack.config.botUserName ?? slack.config.botUserId}
            </dd>
          </dl>
          {isDisconnectArmed ? (
            <InlineConfirm
              role="danger"
              icon={<Unplug size={12} aria-hidden />}
              title="Disconnect Slack?"
              description="Deletes the saved Slack bot token from your keychain and forgets this workspace's connection. Reconnect anytime."
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
          <div className="flex flex-col gap-2">
            <label htmlFor="slack-token" className="text-xs font-semibold text-foreground">
              Bot token
            </label>
            <Input
              id="slack-token"
              type="password"
              autoFocus={shouldAutoFocus}
              placeholder="xoxb-…"
              value={botToken}
              onChange={(event) => setBotToken(event.target.value)}
              disabled={isBusy}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <a
              href={APP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
            >
              Create a Slack app and copy its bot token <ExternalLink size={10} aria-hidden />
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-2xs leading-relaxed text-muted-foreground">
              The bot token starts with <span className="font-mono">xoxb-</span> and needs these
              scopes:
            </p>
            <ul className="flex flex-wrap gap-2">
              {SCOPES.map((scope) => (
                <li
                  key={scope}
                  className="rounded-full border border-border-soft px-2 py-0.5 font-mono text-2xs text-foreground"
                >
                  {scope}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            Public channels only, and Goodboy sees only the ones the bot has joined. Invite it to a
            channel in Slack to read that conversation here. Goodboy also pulls your
            workspace&apos;s full member list, names and avatars, to show who posted in a thread.
            Your token is checked against Slack over HTTPS before anything is stored, then kept in
            your OS keychain, encrypted at rest. It never touches Goodboy&apos;s own servers.
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
