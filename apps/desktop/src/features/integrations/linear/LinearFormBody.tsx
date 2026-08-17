import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { LinearIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { Button, formatError, InlineConfirm, Input } from '@goodboy/ui';
import { CheckCircle2, ExternalLink, Unplug } from 'lucide-react';
import { useAppStore } from '../../../store';

type Props = {
  workspaceId: WorkspaceId;
  onConnected?: () => void;
  shouldAutoFocus?: boolean;
};

export const LinearFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const linear = integrations.find((i) => i.provider === 'linear') ?? null;
  const linearConfig = linear ? (linear.config as LinearIntegrationConfig) : null;
  const connectLinear = useAppStore((s) => s.connectLinear);
  const disconnectLinear = useAppStore((s) => s.disconnectLinear);

  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnectArmed, setIsDisconnectArmed] = useState(false);

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectLinear(workspaceId, token.trim());
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
      await disconnectLinear(workspaceId);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {linear ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 size={14} aria-hidden className="text-success" />
            Connected as {linearConfig?.viewerName}
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
            <dt className="text-muted-foreground">workspace</dt>
            <dd className="font-mono text-foreground">
              linear.app/{linearConfig?.workspaceUrlKey}
            </dd>
          </dl>
          {isDisconnectArmed ? (
            <InlineConfirm
              role="danger"
              icon={<Unplug size={12} aria-hidden />}
              title="Disconnect Linear?"
              description="Deletes the saved Linear token from your keychain and forgets this workspace's connection. Reconnect anytime."
              confirmLabel="Disconnect Linear"
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
            <label htmlFor="linear-pat" className="text-xs font-semibold text-foreground">
              Personal access token
            </label>
            <a
              href="https://linear.app/settings/account/security"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
            >
              Create a token in Linear settings <ExternalLink size={10} aria-hidden />
            </a>
            <Input
              id="linear-pat"
              type="password"
              autoFocus={shouldAutoFocus}
              placeholder="lin_api_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
            />
          </div>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            Read-only scope is enough. The token is stored encrypted in your operating system
            keychain. Goodboy sends it directly to Linear over HTTPS; it never touches
            Goodboy&apos;s own servers.
          </p>
        </>
      )}

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : null}

      {linear ? null : (
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
