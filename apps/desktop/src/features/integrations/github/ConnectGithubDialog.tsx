import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Dialog, Input } from '@goodboy/ui';
import { CheckCircle2, Loader2, Unplug } from 'lucide-react';
import type { GhTokenStatus, WorkspaceId } from '@goodboy/types';
import { ghClearToken, ghSetToken, ghStatus } from '../../github/github';
import { useAppStore } from '../../../store';
import { formatError } from '../../../shared/lib/errors';
import { CreateTokenLink } from './CreateTokenLink';

type Props = {
  workspaceId: WorkspaceId;
  open: boolean;
  onClose: () => void;
};

export const ConnectGithubDialog = ({ workspaceId, open, onClose }: Props) => {
  const [status, setStatus] = useState<GhTokenStatus | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gitlabConnected = useAppStore(
    useShallow((s) =>
      (s.workspaceIntegrations[workspaceId] ?? []).some((i) => i.provider === 'gitlab'),
    ),
  );
  const disconnectGitlab = useAppStore((s) => s.disconnectGitlab);

  const refresh = useCallback(async () => {
    try {
      setStatus(await ghStatus(workspaceId));
    } catch {
      setStatus(null);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  useEffect(() => {
    if (!open) {
      setToken('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await ghSetToken(token.trim(), workspaceId);
      setToken('');
      await refresh();
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
      await ghClearToken(workspaceId);
      await refresh();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const scoped = status?.scoped ?? false;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Connect GitHub"
      description="Per-workspace token (classic, scope repo). Stored in your OS keychain."
      size="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {scoped || gitlabConnected ? null : (
            <Button onClick={() => void onConnect()} disabled={busy || token.trim().length === 0}>
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
        {scoped ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 size={14} aria-hidden className="text-success" />
              Connected as {status?.user ?? '(unknown user)'}
            </div>
            <p className="text-2xs leading-relaxed text-muted-foreground">
              This workspace uses its own token for every gh call.
            </p>
            <Button variant="danger" size="sm" onClick={() => void onDisconnect()} disabled={busy}>
              <Unplug size={12} aria-hidden className="mr-1.5" />
              {busy ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        ) : gitlabConnected ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/40 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              GitLab is connected for this workspace. Disconnect GitLab to use a GitHub token.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void disconnectGitlab(workspaceId)}
              disabled={busy}
            >
              <Unplug size={12} aria-hidden className="mr-1.5" />
              Disconnect GitLab
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {status?.user
                ? `This workspace falls back to your system gh (connected as ${status.user}). Connect a token to override it, e.g. one authorized for this repo's org via SSO.`
                : 'Connect a personal access token so Goodboy can resolve PRs for this workspace.'}
            </p>
            <div className="flex flex-col gap-2">
              <Input
                type="password"
                autoFocus
                placeholder="ghp_…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={busy}
                aria-label="GitHub personal access token"
              />
              <CreateTokenLink />
            </div>
            <p className="text-2xs leading-relaxed text-muted-foreground">
              The token is stored encrypted in your operating system keychain and never leaves this
              machine.
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
};
