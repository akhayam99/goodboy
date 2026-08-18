import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  GitlabWorkspaceIntegration,
  IntegrationCredentialId,
  WorkspaceId,
} from '@goodboy/types';
import { Button, formatError, InlineConfirm, Input } from '@goodboy/ui';
import { CheckCircle2, ExternalLink, Unplug } from 'lucide-react';
import { useAppStore } from '../../../store';
import { IntegrationCredentialPicker } from '../components/IntegrationCredentialPicker';

type Props = {
  workspaceId: WorkspaceId;
  onConnected?: () => void;
  shouldAutoFocus?: boolean;
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

export const GitlabFormBody = ({ workspaceId, onConnected, shouldAutoFocus = false }: Props) => {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const gitlab =
    integrations.find((i): i is GitlabWorkspaceIntegration => i.provider === 'gitlab') ?? null;
  const config = gitlab ? gitlab.config : null;
  const connectGitlab = useAppStore((s) => s.connectGitlab);
  const disconnectIntegration = useAppStore((s) => s.disconnectIntegration);

  const [host, setHost] = useState(DEFAULT_HOST);
  const [token, setToken] = useState('');
  const [credentialId, setCredentialId] = useState<IntegrationCredentialId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnectArmed, setIsDisconnectArmed] = useState(false);

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectGitlab({
        workspaceId,
        host: normalizeHost(host),
        token: token.trim(),
        credentialId,
      });
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
      await disconnectIntegration({ workspaceId, provider: 'gitlab' });
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
          {isDisconnectArmed ? (
            <InlineConfirm
              role="danger"
              icon={<Unplug size={12} aria-hidden />}
              title="Disconnect GitLab?"
              description="Unlinks this project from the GitLab personal API key. The key stays saved for your other projects."
              confirmLabel="Disconnect GitLab"
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
          <IntegrationCredentialPicker
            provider="gitlab"
            selectedCredentialId={credentialId}
            onSelect={(credential) => {
              setCredentialId(credential?.id ?? null);
              if (credential !== null && credential.account !== '') {
                setHost(credential.account);
              }
            }}
            isDisabled={busy}
          />
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
          {credentialId === null ? (
            <>
              <div className="flex flex-col gap-2">
                <label htmlFor="gitlab-pat" className="text-xs font-semibold text-foreground">
                  Personal API key
                </label>
                <a
                  href={tokenUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
                >
                  Create a personal access token (scope read_api){' '}
                  <ExternalLink size={10} aria-hidden />
                </a>
                <Input
                  id="gitlab-pat"
                  type="password"
                  autoFocus={shouldAutoFocus}
                  placeholder="glpat-…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={busy}
                />
              </div>
              <p className="text-2xs leading-relaxed text-muted-foreground">
                The read_api scope is enough. The key is stored encrypted in your operating system
                keychain. Goodboy sends it directly to GitLab over HTTPS; it never touches
                Goodboy&apos;s own servers.
              </p>
            </>
          ) : null}
        </>
      )}

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : null}

      {gitlab != null ? null : (
        <div className="flex justify-end">
          <Button
            onClick={() => void onConnect()}
            disabled={busy || (credentialId === null && token.trim().length === 0)}
            className={busy ? 'animate-border-pulse' : undefined}
          >
            {busy ? 'Verifying…' : 'Connect'}
          </Button>
        </div>
      )}
    </div>
  );
};
