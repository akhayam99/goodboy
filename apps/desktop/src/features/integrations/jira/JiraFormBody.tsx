import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { JiraWorkspaceIntegration, WorkspaceId } from '@goodboy/types';
import { Button, InlineConfirm, Input } from '@goodboy/ui';
import { CheckCircle2, ExternalLink, Unplug } from 'lucide-react';
import { useAppStore } from '../../../store';
import { formatError } from '../../../shared/lib/errors';
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
      (integration): integration is JiraWorkspaceIntegration => integration.provider === 'jira',
    ) ?? null;
  const connectJira = useAppStore((state) => state.connectJira);
  const disconnectJira = useAppStore((state) => state.disconnectJira);

  const [siteUrl, setSiteUrl] = useState('');
  const [email, setEmail] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnectArmed, setIsDisconnectArmed] = useState(false);

  const normalizedSiteUrl = normalizeSiteUrl({ input: siteUrl });
  const trimmedEmail = email.trim();
  const trimmedProjectKey = projectKey.trim().toUpperCase();
  const trimmedToken = apiToken.trim();
  const canConnect =
    normalizedSiteUrl !== '' &&
    trimmedEmail !== '' &&
    trimmedProjectKey !== '' &&
    trimmedToken !== '';

  const onConnect = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await connectJira({
        workspaceId,
        siteUrl: normalizedSiteUrl,
        email: trimmedEmail,
        projectKey: trimmedProjectKey,
        apiToken: trimmedToken,
      });
      setApiToken('');
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
      await disconnectJira({ workspaceId });
    } catch (disconnectError) {
      setError(formatError(disconnectError));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {jira != null ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 size={14} aria-hidden className="text-success" />
            Connected as {jira.config.displayName ?? jira.config.email}
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
            <dt className="text-muted-foreground">site</dt>
            <dd className="font-mono text-foreground">{jira.config.siteUrl}</dd>
            <dt className="text-muted-foreground">project</dt>
            <dd className="font-mono text-foreground">{jira.config.projectKey}</dd>
          </dl>
          {isDisconnectArmed ? (
            <InlineConfirm
              role="danger"
              icon={<Unplug size={12} aria-hidden />}
              title="Disconnect Jira?"
              description="Deletes the saved Jira API token from your keychain and forgets this workspace's connection. Reconnect anytime."
              confirmLabel="Disconnect Jira"
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
            <label htmlFor="jira-site" className="text-xs font-semibold text-foreground">
              Site URL
            </label>
            <Input
              id="jira-site"
              type="text"
              autoFocus={shouldAutoFocus}
              placeholder="https://your-team.atlassian.net"
              value={siteUrl}
              onChange={(event) => setSiteUrl(event.target.value)}
              disabled={isBusy}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="jira-email" className="text-xs font-semibold text-foreground">
              Account email
            </label>
            <Input
              id="jira-email"
              type="email"
              placeholder="you@your-team.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isBusy}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="jira-project" className="text-xs font-semibold text-foreground">
              Project key
            </label>
            <Input
              id="jira-project"
              type="text"
              placeholder="ENG"
              value={projectKey}
              onChange={(event) => setProjectKey(event.target.value)}
              disabled={isBusy}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-2xs leading-relaxed text-muted-foreground">
              One project per workspace. It is the prefix on every issue key, the ENG in ENG-142.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="jira-token" className="text-xs font-semibold text-foreground">
              API token
            </label>
            <Input
              id="jira-token"
              type="password"
              placeholder="ATATT…"
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              disabled={isBusy}
            />
            <a
              href={TOKEN_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
            >
              Create a token in your Atlassian account <ExternalLink size={10} aria-hidden />
            </a>
          </div>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            Jira Cloud only, Data Center and Server are not supported. The token carries your own
            Jira permissions and is stored encrypted in your operating system keychain. Goodboy
            sends it directly to Jira over HTTPS; it never touches Goodboy&apos;s own servers.
          </p>
        </>
      )}

      {error != null ? (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : null}

      {jira == null ? (
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
