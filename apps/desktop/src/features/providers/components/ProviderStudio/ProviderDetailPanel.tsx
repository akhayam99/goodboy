import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Divider, EmptyState, ScrollFade, SectionHeader, StatusDot } from '@goodboy/ui';
import { ArrowRight, RotateCw, Sparkles, type LucideIcon } from 'lucide-react';
import {
  PROVIDER_BETA,
  isApiProvider,
  type ProviderId,
  type ProviderLifecycleAction,
} from '@goodboy/types';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { PROVIDER_BRAND } from '../provider-brand';
import { ProviderCredentialsSection } from './ProviderCredentialsSection';
import { ProviderBindingsSection } from './ProviderBindingsSection';
import { ApiProviderDetail } from './ApiProviderDetail';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly info: ProviderInfo | null;
  readonly onConnect: (action: ProviderLifecycleAction) => void;
};

export const ProviderDetailPanel = ({ info, onConnect }: Props) => {
  if (!info) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          bordered
          tone="neutral"
          icon={CONCEPT_ICONS.providers}
          title="Select a provider"
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }
  if (isApiProvider({ id: info.id })) {
    return <ApiProviderDetail info={info} />;
  }
  return <Detail info={info} onConnect={onConnect} />;
};

function Detail({
  info,
  onConnect,
}: {
  readonly info: ProviderInfo;
  readonly onConnect: (action: ProviderLifecycleAction) => void;
}) {
  const id = info.id as ProviderId;
  const Icon: LucideIcon = PROVIDER_BRAND[id]?.icon ?? Sparkles;
  const lifecycle = useAppStore((s) => s.providerLifecycle[id]);
  const logoutProvider = useAppStore((s) => s.logoutProvider);
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const { showToast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProviders();
    } finally {
      setRefreshing(false);
    }
  }, [refreshProviders]);

  const wasError = useRef(info.connection === 'error');
  useEffect(() => {
    if (info.connection === 'error' && !wasError.current) {
      showToast('error', info.error ?? `${info.label} detection failed`);
    }
    wasError.current = info.connection === 'error';
  }, [info.connection, info.error, info.label, showToast]);

  const inFlight =
    lifecycle.phase === 'installing' ||
    lifecycle.phase === 'connecting' ||
    lifecycle.phase === 'disconnecting';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-8 py-4">
        <Icon
          size={20}
          aria-hidden
          className="shrink-0"
          style={{ color: `var(${PROVIDER_BRAND[id].cssVar})` }}
        />
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground">{info.label}</span>
            {PROVIDER_BETA.has(id) ? (
              <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-2xs font-medium text-warning">
                beta
              </span>
            ) : null}
          </span>
          <span className="truncate text-2xs text-muted-foreground">
            {info.version ? `${info.binary} ${info.version}` : info.binary}
          </span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          aria-label="Re-detect CLIs"
          disabled={refreshing}
          onClick={() => void onRefresh()}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RotateCw size={14} aria-hidden />
        </button>
      </div>
      <Divider />

      <ScrollFade className="flex-1" fadeFrom="background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 py-6">
          <section className="flex flex-col gap-2">
            <SectionHeader label="Account" />
            {inFlight ? (
              <InFlightCard
                label={lifecycle.phase}
                onView={() => onConnect(lifecycle.action ?? 'install')}
              />
            ) : info.connection === 'error' ? (
              <EmptyState
                bordered
                tone="danger"
                icon={CONCEPT_ICONS.providers}
                title="Detection failed"
                action={
                  <Button size="sm" onClick={() => void onRefresh()} disabled={refreshing}>
                    Retry
                  </Button>
                }
              />
            ) : info.connection === 'missing' ? (
              <EmptyState
                bordered
                icon={CONCEPT_ICONS.providers}
                title={`${info.label} CLI not installed`}
                description="Install the CLI to connect an account from Goodboy."
                action={
                  <Button size="sm" onClick={() => onConnect('install')}>
                    Install {info.label}
                  </Button>
                }
              />
            ) : info.connection === 'connected' ? (
              <ConnectedAccount
                identity={info.identity}
                confirmDisconnect={confirmDisconnect}
                onReauth={() => onConnect('login')}
                onAskDisconnect={() => setConfirmDisconnect(true)}
                onCancelDisconnect={() => setConfirmDisconnect(false)}
                onConfirmDisconnect={() => {
                  setConfirmDisconnect(false);
                  void logoutProvider(id);
                }}
              />
            ) : (
              <EmptyState
                bordered
                icon={CONCEPT_ICONS.providers}
                title="No account connected"
                description="Sign in to connect an account. Every step runs in the embedded terminal."
                action={
                  <Button size="sm" onClick={() => onConnect('login')}>
                    Connect account
                  </Button>
                }
              />
            )}
          </section>

          {info.connection !== 'missing' && (
            <>
              <ProviderCredentialsSection providerId={id} />
              <ProviderBindingsSection providerId={id} cliIdentity={info.identity} />
            </>
          )}
        </div>
      </ScrollFade>
    </div>
  );
}

function ConnectedAccount({
  identity,
  confirmDisconnect,
  onReauth,
  onAskDisconnect,
  onCancelDisconnect,
  onConfirmDisconnect,
}: {
  readonly identity: string | null;
  readonly confirmDisconnect: boolean;
  readonly onReauth: () => void;
  readonly onAskDisconnect: () => void;
  readonly onCancelDisconnect: () => void;
  readonly onConfirmDisconnect: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-muted/20 p-4">
      <StatusDot tone="success" size="md" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {identity ?? 'connected'}
        </span>
        <span className="text-2xs text-muted-foreground">connected</span>
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onReauth}
        className="rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        Re-authenticate
      </button>
      {confirmDisconnect ? (
        <>
          <button
            type="button"
            onClick={onConfirmDisconnect}
            className="rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/15"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={onCancelDisconnect}
            className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onAskDisconnect}
          className="rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
        >
          Disconnect
        </button>
      )}
    </div>
  );
}

function InFlightCard({ label, onView }: { readonly label: string; readonly onView: () => void }) {
  return (
    <button
      type="button"
      onClick={onView}
      className="animate-border-pulse flex w-full items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-left text-primary transition-colors hover:bg-primary/10"
    >
      <span className="flex-1 text-sm font-medium capitalize">{label}</span>
      <span className="inline-flex items-center gap-1 text-xs">
        View progress <ArrowRight size={12} aria-hidden />
      </span>
    </button>
  );
}
