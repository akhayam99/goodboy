import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceId } from '@goodboy/types';
import { Button, Dialog, Input } from '@goodboy/ui';
import { CheckCircle2, ExternalLink, Loader2, Unplug } from 'lucide-react';
import { useAppStore } from '../../../store';
import { formatError } from '../../../shared/lib/errors';

type Props = {
  workspaceId: WorkspaceId;
  open: boolean;
  onClose: () => void;
};

export const ConnectLinearDialog = ({ workspaceId, open, onClose }: Props) => {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const linear = integrations.find((i) => i.provider === 'linear') ?? null;
  const connectLinear = useAppStore((s) => s.connectLinear);
  const disconnectLinear = useAppStore((s) => s.disconnectLinear);

  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await connectLinear(workspaceId, token.trim());
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
      await disconnectLinear(workspaceId);
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
      title="Connect Linear"
      description="Personal access token. Stored in your OS keychain."
      size="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {linear ? null : (
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
        {linear ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 size={14} aria-hidden className="text-success" />
              Connected as {linear.config.viewerName}
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
              <dt className="text-muted-foreground">workspace</dt>
              <dd className="font-mono text-foreground">
                linear.app/{linear.config.workspaceUrlKey}
              </dd>
            </dl>
            <Button variant="danger" size="sm" onClick={() => void onDisconnect()} disabled={busy}>
              <Unplug size={12} aria-hidden className="mr-1.5" />
              {busy ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <label htmlFor="linear-pat" className="text-xs font-semibold text-foreground">
                Personal access token
              </label>
              <Input
                id="linear-pat"
                type="password"
                autoFocus
                placeholder="lin_api_…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={busy}
              />
              <a
                href="https://linear.app/settings/account/security"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
              >
                Create a token in Linear settings <ExternalLink size={10} aria-hidden />
              </a>
            </div>
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Read-only scope is enough. The token is stored encrypted in your operating system
              keychain and never leaves this machine.
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
