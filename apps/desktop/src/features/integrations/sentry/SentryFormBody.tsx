import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SentryIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { Button, formatError, InlineConfirm, Input } from '@goodboy/ui';
import { CheckCircle2, ExternalLink, Unplug } from 'lucide-react';
import { useAppStore } from '../../../store';

type Props = {
  workspaceId: WorkspaceId;
  onConnected?: () => void;
  shouldAutoFocus?: boolean;
};

export const SentryFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const sentry = integrations.find((i) => i.provider === 'sentry') ?? null;
  const sentryConfig = (sentry?.config ?? null) as SentryIntegrationConfig | null;
  const connectSentry = useAppStore((s) => s.connectSentry);
  const disconnectSentry = useAppStore((s) => s.disconnectSentry);

  const [token, setToken] = useState('');
  const [org, setOrg] = useState('');
  const [project, setProject] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnectArmed, setIsDisconnectArmed] = useState(false);

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectSentry(workspaceId, token.trim(), org.trim(), project.trim());
      setToken('');
      setOrg('');
      setProject('');
      onConnected?.();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await disconnectSentry(workspaceId);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const canConnect = token.trim().length > 0 && org.trim().length > 0 && project.trim().length > 0;

  return (
    <div className="flex flex-col gap-5">
      {sentry && sentryConfig ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 size={14} aria-hidden className="text-success" />
            Connected to {sentryConfig.projectName ?? sentryConfig.project}
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
            <dt className="text-muted-foreground">organization</dt>
            <dd className="font-mono text-foreground">{sentryConfig.org}</dd>
            <dt className="text-muted-foreground">project</dt>
            <dd className="font-mono text-foreground">{sentryConfig.project}</dd>
          </dl>
          {isDisconnectArmed ? (
            <InlineConfirm
              role="danger"
              icon={<Unplug size={12} aria-hidden />}
              title="Disconnect Sentry?"
              description="Deletes the saved Sentry personal API key from your keychain and forgets this workspace's connection. Reconnect anytime."
              confirmLabel="Disconnect Sentry"
              autoDisarmMs={4000}
              onConfirm={onDisconnect}
              onCancel={() => setIsDisconnectArmed(false)}
            />
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsDisconnectArmed(true)}
              disabled={busy}
            >
              <Unplug size={12} aria-hidden />
              Disconnect
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="sentry-token" className="text-xs font-semibold text-foreground">
              Personal API key
            </label>
            <a
              href="https://sentry.io/settings/account/api/auth-tokens/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
            >
              Create a user auth token in Sentry settings <ExternalLink size={10} aria-hidden />
            </a>
            <Input
              id="sentry-token"
              type="password"
              autoFocus={shouldAutoFocus}
              placeholder="sntryu_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="sentry-org" className="text-xs font-semibold text-foreground">
              Organization slug
            </label>
            <Input
              id="sentry-org"
              placeholder="my-org"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              disabled={busy}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="sentry-project" className="text-xs font-semibold text-foreground">
              Project slug
            </label>
            <Input
              id="sentry-project"
              placeholder="my-project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              disabled={busy}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            A key with issue read scope is enough. It is stored encrypted in your operating system
            keychain. Goodboy sends it directly to Sentry over HTTPS; it never touches
            Goodboy&apos;s own servers.
          </p>
        </>
      )}

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : null}

      {sentry ? null : (
        <div className="flex justify-end">
          <Button
            onClick={() => void onConnect()}
            disabled={busy || !canConnect}
            className={busy ? 'animate-border-pulse' : undefined}
          >
            {busy ? 'Verifying…' : 'Connect'}
          </Button>
        </div>
      )}
    </div>
  );
};
