import { useEffect, useState } from 'react';
import { GitFork as GithubIcon, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Input, cn } from '@kay-am/ui';
import { useAppStore } from '../store';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function GithubPanel() {
  const status = useAppStore((s) => s.githubStatus);
  const refreshStatus = useAppStore((s) => s.refreshGithubStatus);
  const setPat = useAppStore((s) => s.setGithubPat);
  const clearToken = useAppStore((s) => s.clearGithubToken);

  const [token, setToken] = useState('');
  const [save, setSave] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!status) void refreshStatus();
  }, [status, refreshStatus]);

  const onConnect = async () => {
    if (!token.trim()) return;
    setSave('saving');
    setError(null);
    try {
      await setPat(token.trim());
      setToken('');
      setSave('saved');
    } catch (err) {
      setSave('error');
      setError(err instanceof Error ? err.message : String(err));
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
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <GithubIcon size={16} aria-hidden className="text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">GitHub</h2>
      </div>

      {status === null ? (
        <p className="text-xs text-muted-foreground">checking gh status…</p>
      ) : !status.available ? (
        <NotInstalled />
      ) : status.mode === 'absent' ? (
        <Absent token={token} setToken={setToken} onConnect={onConnect} save={save} error={error} />
      ) : (
        <Connected status={status} onDisconnect={onDisconnect} save={save} />
      )}
    </div>
  );
}

function NotInstalled() {
  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
      <div className="flex items-start gap-2">
        <AlertCircle size={14} aria-hidden className="mt-0.5" />
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
            so kAY.am can resolve PR state.
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
        connect with a personal access token (classic or fine-grained, scope:{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">repo</code>) — or run{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">gh auth login</code> in
        a terminal and reload kAY.am.
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="password"
          placeholder="ghp_…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="flex-1 font-mono text-xs"
          aria-label="GitHub personal access token"
        />
        <Button
          size="sm"
          onClick={onConnect}
          disabled={save === 'saving' || token.trim().length === 0}
        >
          {save === 'saving' ? (
            <Loader2 size={12} className="mr-1 animate-spin" aria-hidden />
          ) : null}
          connect
        </Button>
      </div>
      {error ? (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
      <p className="text-[10px] text-muted-foreground">
        token is stored in your OS keychain via the system credential store. it never leaves your
        machine.
      </p>
    </div>
  );
}

function Connected({
  status,
  onDisconnect,
  save,
}: {
  status: { user?: string; mode: string; version?: string; scopes?: ReadonlyArray<string> };
  onDisconnect: () => void;
  save: SaveState;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2.5 text-xs text-success">
        <div className="flex items-start gap-2">
          <Check size={14} aria-hidden className="mt-0.5" />
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
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={onDisconnect}
          disabled={save === 'saving'}
          className={cn(save === 'saving' && 'opacity-60')}
        >
          disconnect
        </Button>
      </div>
    </div>
  );
}
