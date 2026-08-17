import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { BitbucketWorkspaceIntegration, WorkspaceId } from '@goodboy/types';
import { Button, formatError, InlineConfirm, Input } from '@goodboy/ui';
import { CheckCircle2, ExternalLink, Unplug } from 'lucide-react';
import { useAppStore } from '../../../store';
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
      (integration): integration is BitbucketWorkspaceIntegration =>
        integration.provider === 'bitbucket',
    ) ?? null;
  const connectBitbucket = useAppStore((state) => state.connectBitbucket);
  const disconnectBitbucket = useAppStore((state) => state.disconnectBitbucket);

  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnectArmed, setIsDisconnectArmed] = useState(false);

  const normalizedSlug = normalizeWorkspaceSlug({ input: workspaceSlug });
  const trimmedEmail = email.trim();
  const trimmedToken = apiToken.trim();
  const canConnect = normalizedSlug !== '' && trimmedEmail !== '' && trimmedToken !== '';

  const onConnect = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await connectBitbucket({
        workspaceId,
        workspaceSlug: normalizedSlug,
        email: trimmedEmail,
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
      await disconnectBitbucket({ workspaceId });
    } catch (disconnectError) {
      setError(formatError(disconnectError));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {bitbucket != null ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 size={14} aria-hidden className="text-success" />
            Connected as {bitbucket.config.displayName ?? bitbucket.config.email}
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
            <dt className="text-muted-foreground">workspace</dt>
            <dd className="font-mono text-foreground">{bitbucket.config.workspaceSlug}</dd>
            <dt className="text-muted-foreground">account</dt>
            <dd className="font-mono text-foreground">{bitbucket.config.email}</dd>
          </dl>
          {isDisconnectArmed ? (
            <InlineConfirm
              role="danger"
              icon={<Unplug size={12} aria-hidden />}
              title="Disconnect Bitbucket?"
              description="Deletes the saved Bitbucket API token from your keychain and forgets this workspace's connection. Reconnect anytime."
              confirmLabel="Disconnect Bitbucket"
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
            <label htmlFor="bitbucket-workspace" className="text-xs font-semibold text-foreground">
              Workspace slug
            </label>
            <Input
              id="bitbucket-workspace"
              type="text"
              autoFocus={shouldAutoFocus}
              placeholder="your-team"
              value={workspaceSlug}
              onChange={(event) => setWorkspaceSlug(event.target.value)}
              disabled={isBusy}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-2xs leading-relaxed text-muted-foreground">
              The segment right after bitbucket.org in your repository url, not the display name.
              Pasting a full repository url works too.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="bitbucket-email" className="text-xs font-semibold text-foreground">
              Account email
            </label>
            <Input
              id="bitbucket-email"
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
            <label htmlFor="bitbucket-token" className="text-xs font-semibold text-foreground">
              API token
            </label>
            <a
              href={TOKEN_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
            >
              Create a token in your Atlassian account <ExternalLink size={10} aria-hidden />
            </a>
            <Input
              id="bitbucket-token"
              type="password"
              placeholder="ATATT…"
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              disabled={isBusy}
            />
          </div>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            Bitbucket Cloud only, Data Center and Server are not supported. An older Bitbucket app
            password works in the same field while Atlassian keeps it alive. The secret carries your
            own Bitbucket permissions and is stored encrypted in your operating system keychain.
            Goodboy sends it directly to Bitbucket over HTTPS; it never touches Goodboy&apos;s own
            servers.
          </p>
        </>
      )}

      {error != null ? (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : null}

      {bitbucket == null ? (
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
