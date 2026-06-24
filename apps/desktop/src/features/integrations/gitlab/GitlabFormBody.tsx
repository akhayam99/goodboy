import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GitlabWorkspaceIntegration, WorkspaceId } from '@goodboy/types';
import { Button, Input } from '@goodboy/ui';
import { CheckCircle2, ExternalLink, Unplug } from 'lucide-react';
import { useAppStore } from '../../../store';
import { ghClearToken, ghStatus } from '../../github/github';
import { formatError } from '../../../shared/lib/errors';

type Props = {
  workspaceId: WorkspaceId;
  onConnected?: () => void;
};

const DEFAULT_HOST = 'https://gitlab.com';

function normalizeHost(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (trimmed === '') {
    return DEFAULT_HOST;
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return DEFAULT_HOST;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_HOST;
  }
}

export const GitlabFormBody = ({ workspaceId, onConnected }: Props) => {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const gitlab =
    integrations.find((i): i is GitlabWorkspaceIntegration => i.provider === 'gitlab') ?? null;
  const config = gitlab ? gitlab.config : null;
  const connectGitlab = useAppStore((s) => s.connectGitlab);
  const disconnectGitlab = useAppStore((s) => s.disconnectGitlab);

  const [host, setHost] = useState(DEFAULT_HOST);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubScoped, setGithubScoped] = useState(false);

  useEffect(() => {
    void ghStatus(workspaceId)
      .then((status) => setGithubScoped(status.scoped ?? false))
      .catch(() => setGithubScoped(false));
  }, [workspaceId]);

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectGitlab(workspaceId, normalizeHost(host), token.trim());
      setToken('');
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
      await disconnectGitlab(workspaceId);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const onDisconnectGithub = async () => {
    setBusy(true);
    setError(null);
    try {
      await ghClearToken(workspaceId);
      setGithubScoped(false);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const tokenUrl = `${normalizeHost(host)}/-/profile/personal_access_tokens`;

  return (
    <div className="flex flex-col gap-5">
      {gitlab && config ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 size={14} aria-hidden className="text-success" />
            Connected as {config.userName}
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
            <dt className="text-muted-foreground">host</dt>
            <dd className="font-mono text-foreground">{config.host}</dd>
          </dl>
          <Button variant="danger" size="sm" onClick={() => void onDisconnect()} disabled={busy}>
            <Unplug size={12} aria-hidden className="mr-1.5" />
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </div>
      ) : githubScoped ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/40 p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            A GitHub token is connected for this workspace. Disconnect GitHub to use GitLab.
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => void onDisconnectGithub()}
            disabled={busy}
          >
            <Unplug size={12} aria-hidden className="mr-1.5" />
            {busy ? 'Disconnecting…' : 'Disconnect GitHub'}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="gitlab-host" className="text-xs font-semibold text-foreground">
              Host
            </label>
            <Input
              id="gitlab-host"
              type="text"
              placeholder={DEFAULT_HOST}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              disabled={busy}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="gitlab-pat" className="text-xs font-semibold text-foreground">
              Personal access token
            </label>
            <Input
              id="gitlab-pat"
              type="password"
              autoFocus
              placeholder="glpat-…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
            />
            <a
              href={tokenUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
            >
              Create a token (scope read_api) <ExternalLink size={10} aria-hidden />
            </a>
          </div>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            The read_api scope is enough. The token is stored encrypted in your operating system
            keychain and never leaves this machine.
          </p>
        </>
      )}

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : null}

      {gitlab || githubScoped ? null : (
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
