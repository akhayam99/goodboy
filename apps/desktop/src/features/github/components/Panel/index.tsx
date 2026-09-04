import { useEffect, useState } from 'react';
import { Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Button, cn, formatError, Input, Tooltip } from '@goodboy/ui';
import { GithubIcon } from '@goodboy/ui';
import type { SaveState } from '../../../../shared/types/saveState';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

const TOKEN_CREATE_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=Goodboy';
const TOKEN_LIST_URL = 'https://github.com/settings/tokens';

const CreateTokenLink = () => (
  <p className="text-3xs leading-relaxed text-muted-foreground">
    <a
      href={TOKEN_CREATE_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
    >
      Create a personal access token on GitHub
    </a>{' '}
    (scope <code className="rounded bg-muted px-1 py-0.5 font-mono">repo</code>), then{' '}
    <a
      href={TOKEN_LIST_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
    >
      Configure SSO
    </a>{' '}
    if your org requires it.
  </p>
);

export const GithubPanel = ({ hideSectionHeader }: { hideSectionHeader?: boolean } = {}) => {
  const status = useAppStore((s) => s.githubStatus);
  const refreshStatus = useAppStore((s) => s.refreshGithubStatus);
  const setPat = useAppStore((s) => s.setGithubPat);
  const clearToken = useAppStore((s) => s.clearGithubToken);

  const [token, setToken] = useState('');
  const [save, setSave] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!status) {
      void refreshStatus();
    }
  }, [status, refreshStatus]);

  const onReload = async () => {
    setChecking(true);
    try {
      await refreshStatus();
    } finally {
      setChecking(false);
    }
  };

  const onConnect = async () => {
    if (!token.trim()) {
      return;
    }
    setSave('saving');
    setError(null);
    try {
      await setPat(token.trim());
      setToken('');
      setSave('saved');
    } catch (err) {
      setSave('error');
      setError(formatError(err));
    }
  };

  const onDisconnect = async () => {
    setSave('saving');
    setError(null);
    try {
      await clearToken();
      setSave('saved');
    } catch (err) {
      setSave('error');
      setError(formatError(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {!hideSectionHeader && (
          <>
            <GithubIcon size={ICON_SIZE.control} aria-hidden className="text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              GitHub
            </h2>
          </>
        )}
        <div className="flex-1" />
        <Tooltip content="Refresh GitHub status" anchorClassName="shrink-0">
          <button
            type="button"
            onClick={() => void onReload()}
            disabled={checking}
            aria-label="Refresh GitHub status"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground ring-1 ring-border-soft/40 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={ICON_SIZE.row} aria-hidden />
          </button>
        </Tooltip>
      </div>

      {status === null ? (
        <p className="text-xs text-muted-foreground">checking gh status…</p>
      ) : !status.available ? (
        <NotInstalled />
      ) : status.mode === 'absent' ? (
        <Absent token={token} setToken={setToken} onConnect={onConnect} save={save} error={error} />
      ) : (
        <Connected
          status={status}
          onDisconnect={onDisconnect}
          save={save}
          token={token}
          setToken={setToken}
          onConnect={onConnect}
          error={error}
        />
      )}

      <p className="text-3xs leading-relaxed text-muted-foreground">
        This is your baseline (system gh / global key). To use a different personal API key for a
        specific repo (e.g. SSO-authorized for its org), connect one per-workspace in that
        workspace&apos;s Settings → Integrations.
      </p>
    </div>
  );
};

function NotInstalled() {
  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
      <div className="flex items-start gap-2">
        <AlertCircle size={ICON_SIZE.control} aria-hidden className="mt-0.5" />
        <div className="flex flex-col gap-1">
          <span className="font-medium">gh CLI not detected</span>
          <span className="text-warning/80">
            install from{' '}
            <a
              href="https://cli.github.com/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              cli.github.com
            </a>{' '}
            so Goodboy can resolve PR state.
          </span>
        </div>
      </div>
    </div>
  );
}

function Absent({
  token,
  setToken,
  onConnect,
  save,
  error,
}: {
  token: string;
  setToken: (v: string) => void;
  onConnect: () => void;
  save: SaveState;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        connect with a personal API key (classic or fine-grained personal access token, scope:{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-3xs">repo</code>), or run{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-3xs">gh auth login</code> in a
        terminal and reload Goodboy.
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="password"
          placeholder="ghp_…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="flex-1 font-mono text-xs"
          aria-label="GitHub personal API key"
        />
        <Button
          size="sm"
          onClick={onConnect}
          disabled={save === 'saving' || token.trim().length === 0}
          className={cn(save === 'saving' && 'animate-border-pulse')}
        >
          Connect
        </Button>
      </div>
      {error ? (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
      <CreateTokenLink />
      <p className="text-3xs text-muted-foreground">
        the key is stored in your OS keychain via the system credential store. Goodboy sends it
        directly to GitHub over HTTPS; it never touches Goodboy&apos;s own servers.
      </p>
    </div>
  );
}

function Connected({
  status,
  onDisconnect,
  save,
  token,
  setToken,
  onConnect,
  error,
}: {
  status: { user?: string; mode: string; version?: string; scopes?: ReadonlyArray<string> };
  onDisconnect: () => void;
  save: SaveState;
  token: string;
  setToken: (v: string) => void;
  onConnect: () => void;
  error: string | null;
}) {
  const viaPat = status.mode === 'pat';
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2.5 text-xs text-success">
        <div className="flex items-start gap-2">
          <Check size={ICON_SIZE.control} aria-hidden className="mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">connected as {status.user ?? '(unknown user)'}</span>
            <span className="text-success/80">
              mode: {status.mode}
              {status.version ? ` · gh ${status.version}` : ''}
            </span>
            {status.scopes && status.scopes.length > 0 ? (
              <span className="text-success/80">scopes: {status.scopes.join(', ')}</span>
            ) : null}
          </div>
        </div>
      </div>
      {viaPat ? (
        <div className="flex items-center justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={onDisconnect}
            disabled={save === 'saving'}
            className={cn(save === 'saving' && 'opacity-60')}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-3xs leading-relaxed text-muted-foreground">
            Using your system gh login, Goodboy is not storing a key. To disconnect, run{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">gh auth logout</code> in a
            terminal. To use a different personal API key here (e.g. one authorized for your org via
            SSO), connect one below.
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="password"
              placeholder="ghp_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="flex-1 font-mono text-xs"
              aria-label="GitHub personal API key"
            />
            <Button
              size="sm"
              onClick={onConnect}
              disabled={save === 'saving' || token.trim().length === 0}
              className={cn(save === 'saving' && 'animate-border-pulse')}
            >
              Use a key
            </Button>
          </div>
          <CreateTokenLink />
          {error ? (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
