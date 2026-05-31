import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { JiraIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { Button, Dialog, Input } from '@goodboy/ui';
import { CheckCircle2, ExternalLink, Loader2, Unplug } from 'lucide-react';
import { useAppStore } from '../../../store';
import { formatError } from '../../../shared/lib/errors';

interface Props {
  workspaceId: WorkspaceId;
  open: boolean;
  onClose: () => void;
}

/**
 * Connect Jira via Atlassian API token + email (HTTP Basic auth against the
 * tenant site URL). The token is verified server-side by the Rust client
 * (calls /rest/api/3/myself), then saved into the OS keychain. siteUrl +
 * email are cached in the workspace_integrations config row for offline use.
 *
 * Disconnect removes both the keychain entry and the DB row.
 */
export function ConnectJiraDialog({ workspaceId, open, onClose }: Props) {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const jiraRaw = integrations.find((i) => i.provider === 'jira') ?? null;
  const jiraConfig = jiraRaw ? (jiraRaw.config as JiraIntegrationConfig) : null;
  const connectJira = useAppStore((s) => s.connectJira);
  const disconnectJira = useAppStore((s) => s.disconnectJira);

  const [siteUrl, setSiteUrl] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSiteUrl('');
      setEmail('');
      setToken('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const canConnect =
    siteUrl.trim().length > 0 && email.trim().length > 0 && token.trim().length > 0;

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectJira(workspaceId, siteUrl.trim(), email.trim(), token.trim());
      setSiteUrl('');
      setEmail('');
      setToken('');
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
      await disconnectJira(workspaceId);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Connect Jira"
      description="Atlassian API token via HTTP Basic auth. Stored in your OS keychain."
      size="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {jiraRaw ? null : (
            <Button onClick={() => void onConnect()} disabled={busy || !canConnect}>
              {busy ? (
                <>
                  <Loader2 size={13} className="mr-1.5 animate-spin" aria-hidden /> Verifying…
                </>
              ) : (
                'Connect'
              )}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {jiraRaw && jiraConfig ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 size={14} aria-hidden className="text-success" />
              Connected as {jiraConfig.viewerName}
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
              <dt className="text-muted-foreground">site</dt>
              <dd className="font-mono text-foreground">{jiraConfig.siteUrl}</dd>
              <dt className="text-muted-foreground">email</dt>
              <dd className="font-mono text-foreground">{jiraConfig.viewerEmail}</dd>
            </dl>
            <Button variant="danger" size="sm" onClick={() => void onDisconnect()} disabled={busy}>
              <Unplug size={12} aria-hidden className="mr-1.5" />
              {busy ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="jira-site-url" className="text-xs font-semibold text-foreground">
                  Site URL
                </label>
                <Input
                  id="jira-site-url"
                  type="url"
                  autoFocus
                  placeholder="https://your-org.atlassian.net"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="jira-email" className="text-xs font-semibold text-foreground">
                  Email
                </label>
                <Input
                  id="jira-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="jira-token" className="text-xs font-semibold text-foreground">
                  API token
                </label>
                <Input
                  id="jira-token"
                  type="password"
                  placeholder="ATATT3x…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={busy}
                />
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
                >
                  Create an API token in Atlassian settings <ExternalLink size={10} aria-hidden />
                </a>
              </div>
            </div>
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Read-only scope is enough. The token is stored encrypted in your OS keychain and never
              leaves this machine. Goodboy reads it from Rust only.
            </p>
          </>
        )}

        {error ? (
          <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
