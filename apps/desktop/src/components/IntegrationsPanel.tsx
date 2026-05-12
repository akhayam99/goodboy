import { useEffect, useState } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { Button, Input, cn } from '@kay-am/ui';
import { setSecret, deleteSecret, hasSecret, getSecret } from '../secrets';
import { GithubPanel } from './GithubPanel';

type CardState = 'loading' | 'connected' | 'disconnected';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// ─── generic single-token card ────────────────────────────────────────────────

interface TokenCardProps {
  secretKey: string;
  label: string;
  placeholder: string;
  hint: string;
}

function TokenCard({ secretKey, label, placeholder, hint }: TokenCardProps) {
  const [cardState, setCardState] = useState<CardState>('loading');
  const [token, setToken] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void hasSecret(secretKey).then((has) => setCardState(has ? 'connected' : 'disconnected'));
  }, [secretKey]);

  const onConnect = async () => {
    if (!token.trim()) return;
    setSaveState('saving');
    setError(null);
    try {
      await setSecret(secretKey, token.trim());
      setToken('');
      setCardState('connected');
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onDisconnect = async () => {
    setSaveState('saving');
    setError(null);
    try {
      await deleteSecret(secretKey);
      setCardState('disconnected');
      setSaveState('idle');
    } catch (err) {
      setSaveState('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (cardState === 'loading') {
    return <p className="text-xs text-muted-foreground">checking…</p>;
  }

  if (cardState === 'connected') {
    return (
      <div className="flex flex-col gap-2">
        <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2.5 text-xs text-success">
          <div className="flex items-center gap-2">
            <Check size={13} aria-hidden />
            <span className="font-medium">connected</span>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void onDisconnect()}
            disabled={saveState === 'saving'}
            className={cn(saveState === 'saving' && 'opacity-60')}
          >
            disconnect
          </Button>
        </div>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-2">
        <Input
          type="password"
          placeholder={placeholder}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="flex-1 font-mono text-xs"
          aria-label={label}
        />
        <Button
          size="sm"
          onClick={() => void onConnect()}
          disabled={saveState === 'saving' || !token.trim()}
        >
          {saveState === 'saving' ? (
            <Loader2 size={12} className="mr-1 animate-spin" aria-hidden />
          ) : null}
          connect
        </Button>
      </div>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <p className="text-[10px] text-muted-foreground">
        stored in your OS keychain. never leaves your machine.
      </p>
    </div>
  );
}

// ─── jira card (domain + email + token) ───────────────────────────────────────

const JIRA_KEY_DOMAIN = 'integration.jira.domain';
const JIRA_KEY_EMAIL = 'integration.jira.email';
const JIRA_KEY_TOKEN = 'integration.jira.token';

function JiraCard() {
  const [cardState, setCardState] = useState<CardState>('loading');
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [connectedDomain, setConnectedDomain] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const has = await hasSecret(JIRA_KEY_TOKEN);
      if (has) {
        const d = await getSecret(JIRA_KEY_DOMAIN);
        setConnectedDomain(d ?? null);
        setCardState('connected');
      } else {
        setCardState('disconnected');
      }
    })();
  }, []);

  const onConnect = async () => {
    if (!domain.trim() || !email.trim() || !token.trim()) return;
    setSaveState('saving');
    setError(null);
    try {
      await setSecret(JIRA_KEY_DOMAIN, domain.trim());
      await setSecret(JIRA_KEY_EMAIL, email.trim());
      await setSecret(JIRA_KEY_TOKEN, token.trim());
      setConnectedDomain(domain.trim());
      setDomain('');
      setEmail('');
      setToken('');
      setCardState('connected');
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onDisconnect = async () => {
    setSaveState('saving');
    setError(null);
    try {
      await deleteSecret(JIRA_KEY_DOMAIN);
      await deleteSecret(JIRA_KEY_EMAIL);
      await deleteSecret(JIRA_KEY_TOKEN);
      setConnectedDomain(null);
      setCardState('disconnected');
      setSaveState('idle');
    } catch (err) {
      setSaveState('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (cardState === 'loading') {
    return <p className="text-xs text-muted-foreground">checking…</p>;
  }

  if (cardState === 'connected') {
    return (
      <div className="flex flex-col gap-2">
        <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2.5 text-xs text-success">
          <div className="flex items-center gap-2">
            <Check size={13} aria-hidden />
            <span className="font-medium">
              connected{connectedDomain ? ` · ${connectedDomain}` : ''}
            </span>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void onDisconnect()}
            disabled={saveState === 'saving'}
            className={cn(saveState === 'saving' && 'opacity-60')}
          >
            disconnect
          </Button>
        </div>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      </div>
    );
  }

  const canConnect = domain.trim() && email.trim() && token.trim();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Jira Cloud API token — generate one at{' '}
        <span className="font-mono text-[10px]">id.atlassian.com → security → API tokens</span>.
      </p>
      <div className="flex flex-col gap-2">
        <Input
          placeholder="yourcompany.atlassian.net"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="font-mono text-xs"
          aria-label="Jira domain"
        />
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-xs"
          aria-label="Atlassian account email"
        />
        <div className="flex items-center gap-2">
          <Input
            type="password"
            placeholder="ATATT3x…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="flex-1 font-mono text-xs"
            aria-label="Jira API token"
          />
          <Button
            size="sm"
            onClick={() => void onConnect()}
            disabled={saveState === 'saving' || !canConnect}
          >
            {saveState === 'saving' ? (
              <Loader2 size={12} className="mr-1 animate-spin" aria-hidden />
            ) : null}
            connect
          </Button>
        </div>
      </div>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <p className="text-[10px] text-muted-foreground">
        stored in your OS keychain. never leaves your machine.
      </p>
    </div>
  );
}

// ─── section wrapper ───────────────────────────────────────────────────────────

function IntegrationSection({
  icon,
  name,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">{name}</h2>
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border" />;
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
      <div className="flex items-center gap-2">
        <AlertCircle size={12} aria-hidden />
        <span>{children}</span>
      </div>
    </div>
  );
}

// ─── svgs for brand icons (minimal inline) ────────────────────────────────────

function GitLabIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="text-muted-foreground"
    >
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.92z" />
    </svg>
  );
}

function JiraIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="text-muted-foreground"
    >
      <path d="M11.571 11.429 6 5.857l5.571-5.572L17.143 6l-5.572 5.429zm.858.857L18 18l-5.571 5.571L6.857 18l5.572-5.714z" />
    </svg>
  );
}

function LinearIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="text-muted-foreground"
    >
      <path d="M3.374 5.268a.7.7 0 0 1 .99-.99l15.358 15.358a.7.7 0 0 1-.99.99L3.374 5.268zM2.5 8.25A5.75 5.75 0 0 1 14.197 4.09l-9.11 9.11A5.75 5.75 0 0 1 2.5 8.25zm8.803 11.16A5.75 5.75 0 0 0 19.91 11.1l-8.607 8.31z" />
    </svg>
  );
}

// ─── public panel ─────────────────────────────────────────────────────────────

export function IntegrationsPanel() {
  return (
    <div className="flex flex-col gap-5">
      <IntegrationSection
        icon={
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
            className="text-muted-foreground"
          >
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
        }
        name="GitHub"
      >
        <GithubPanel hideSectionHeader />
      </IntegrationSection>

      <Divider />

      <IntegrationSection icon={<GitLabIcon />} name="GitLab">
        <TokenCard
          secretKey="integration.gitlab.token"
          label="GitLab personal access token"
          placeholder="glpat-…"
          hint="Personal access token with api or read_api scope — Settings → Access Tokens."
        />
      </IntegrationSection>

      <Divider />

      <IntegrationSection icon={<JiraIcon />} name="Jira">
        <JiraCard />
      </IntegrationSection>

      <Divider />

      <IntegrationSection icon={<LinearIcon />} name="Linear">
        <TokenCard
          secretKey="integration.linear.token"
          label="Linear API key"
          placeholder="lin_api_…"
          hint="Personal API key — Settings → API → Personal API keys → New key."
        />
      </IntegrationSection>
    </div>
  );
}
