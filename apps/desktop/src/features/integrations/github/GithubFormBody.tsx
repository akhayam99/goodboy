import { useCallback, useEffect, useState } from 'react';
import { Button, formatError, InlineConfirm, Input } from '@goodboy/ui';
import { CheckCircle2, Unplug } from 'lucide-react';
import type { GhTokenStatus, WorkspaceId } from '@goodboy/types';
import { ghClearToken, ghSetToken, ghStatus } from '../../github/github';
import { CreateTokenLink } from './CreateTokenLink';
import { notifyGithubConnectionChanged } from './useGithubConnection';

type Props = {
  workspaceId: WorkspaceId;
  onConnected?: () => void;
  shouldAutoFocus?: boolean;
};

export const GithubFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const [status, setStatus] = useState<GhTokenStatus | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnectArmed, setIsDisconnectArmed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await ghStatus(workspaceId));
    } catch {
      setStatus(null);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await ghSetToken(token.trim(), workspaceId);
      setToken('');
      await refresh();
      notifyGithubConnectionChanged();
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
      await ghClearToken(workspaceId);
      await refresh();
      notifyGithubConnectionChanged();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const scoped = status?.scoped ?? false;

  return (
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
          {isDisconnectArmed ? (
            <InlineConfirm
              role="danger"
              icon={<Unplug size={12} aria-hidden />}
              title="Disconnect GitHub?"
              description="Deletes this workspace's GitHub token from your keychain. This does not sign you out of the system gh CLI."
              confirmLabel="Disconnect GitHub"
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
          <p className="text-xs leading-relaxed text-muted-foreground">
            {status?.user
              ? `This workspace falls back to your system gh (connected as ${status.user}). Connect a token to override it, e.g. one authorized for this repo's org via SSO.`
              : 'Connect a personal access token so Goodboy can resolve PRs for this workspace.'}
          </p>
          <div className="flex flex-col gap-2">
            <Input
              type="password"
              autoFocus={shouldAutoFocus}
              placeholder="ghp_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
              aria-label="GitHub personal access token"
            />
            <CreateTokenLink />
          </div>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            The token is stored encrypted in your operating system keychain. Goodboy sends it
            directly to GitHub over HTTPS; it never touches Goodboy&apos;s own servers.
          </p>
        </>
      )}

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : null}

      {scoped ? null : (
        <div className="flex justify-end">
          <Button
            onClick={() => void onConnect()}
            disabled={busy || token.trim().length === 0}
            className={busy ? 'animate-border-pulse' : undefined}
          >
            {busy ? 'Verifying…' : 'Connect'}
          </Button>
        </div>
      )}
    </div>
  );
};
