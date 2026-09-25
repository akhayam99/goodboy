import { PROVIDER_CONNECT_CAPABILITIES, isApiProvider } from '@goodboy/core';
import { useCallback, useState } from 'react';
import {
  Button,
  EmptyState,
  InlineConfirm,
  SectionHeader,
  StatusDot,
  Tooltip,
  cn,
  tintClasses,
} from '@goodboy/ui';
import { RotateCw, Unplug, type LucideIcon } from 'lucide-react';
import { type ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { PROVIDER_BRAND } from '../provider-brand';
import { ProviderConnect } from '../ProviderConnect';
import { ProviderCredentialsSection } from './ProviderCredentialsSection';
import { ProviderBindingsSection } from './ProviderBindingsSection';
import { ApiProviderDetail } from './ApiProviderDetail';
import { CliUpdateNotice } from './CliUpdateNotice';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { SETTINGS_PANE_ENTRY } from '../../../settings/components/SettingsStudio/settingsPaneEntry';

type Props = {
  readonly info: ProviderDisplayInfo | null;
  readonly autoConnect: boolean;
  readonly autoUpdate: boolean;
};

export const ProviderDetailPanel = ({ info, autoConnect, autoUpdate }: Props) => {
  if (!info) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.providers}
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
  return <Detail info={info} autoConnect={autoConnect} autoUpdate={autoUpdate} />;
};

function Detail({
  info,
  autoConnect,
  autoUpdate,
}: {
  readonly info: ProviderDisplayInfo;
  readonly autoConnect: boolean;
  readonly autoUpdate: boolean;
}) {
  const id = info.id as ProviderId;
  const Icon: LucideIcon = PROVIDER_BRAND[id]?.icon ?? CONCEPT_ICONS.providers;
  const connectPhase = useAppStore((s) => s.providerConnect[id].phase);
  const connectProvider = useAppStore((s) => s.connectProvider);
  const logoutProvider = useAppStore((s) => s.logoutProvider);
  const refreshProviders = useAppStore((s) => s.refreshProviders);

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

  const settled =
    connectPhase === 'idle' || connectPhase === 'cancelled' || connectPhase === 'success';
  const showConnected = info.connection === 'connected' && settled;

  const subtitle = info.version ? `${info.binary} ${info.version}` : info.binary;
  const action = (
    <div className="flex items-center gap-2">
      <Tooltip content="Re-detect CLIs">
        <button
          type="button"
          aria-label="Re-detect CLIs"
          disabled={refreshing}
          onClick={() => void onRefresh()}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground disabled:opacity-50"
        >
          <RotateCw size={ICON_SIZE.control} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );

  return (
    <PaneShell
      scroll="body"
      animationClassName={SETTINGS_PANE_ENTRY}
      glyph={
        <Icon
          size={ICON_SIZE.hero}
          aria-hidden
          className="shrink-0"
          style={{ color: `var(${PROVIDER_BRAND[id].cssVar})` }}
        />
      }
      title={info.label}
      meta={subtitle}
      actions={action}
    >
      {info.connection !== 'missing' && info.connection !== 'unknown' && (
        <CliUpdateNotice providerId={id} autoStart={autoUpdate} />
      )}
      <section className="flex flex-col gap-2">
        <SectionHeader label="Account" />
        {info.connection === 'error' && settled ? (
          <EmptyState
            bordered
            tone={CONCEPT_TONE.providers}
            icon={CONCEPT_ICONS.providers}
            title="Detection failed"
            description={info.error ?? `Goodboy couldn't detect the ${info.label} CLI.`}
            action={
              <Button size="sm" onClick={() => void onRefresh()} disabled={refreshing}>
                Retry
              </Button>
            }
          />
        ) : showConnected ? (
          <ConnectedAccount
            label={info.label}
            identity={info.identity}
            canReauth={PROVIDER_CONNECT_CAPABILITIES[id].tier !== 'manual'}
            confirmDisconnect={confirmDisconnect}
            onReauth={() => void connectProvider(id)}
            onAskDisconnect={() => setConfirmDisconnect(true)}
            onCancelDisconnect={() => setConfirmDisconnect(false)}
            onConfirmDisconnect={() => {
              setConfirmDisconnect(false);
              void logoutProvider(id);
            }}
          />
        ) : (
          <ProviderConnect
            providerId={id}
            chrome="studio"
            autoStart={autoConnect}
            onDone={() => void onRefresh()}
          />
        )}
      </section>

      {info.connection !== 'missing' && info.connection !== 'unknown' && (
        <>
          <ProviderCredentialsSection providerId={id} />
          <ProviderBindingsSection providerId={id} cliIdentity={info.identity} />
        </>
      )}
    </PaneShell>
  );
}

type ConnectedAccountProps = {
  readonly label: string;
  readonly identity: string | null;
  readonly canReauth: boolean;
  readonly confirmDisconnect: boolean;
  readonly onReauth: () => void;
  readonly onAskDisconnect: () => void;
  readonly onCancelDisconnect: () => void;
  readonly onConfirmDisconnect: () => void;
};

const ConnectedAccount = ({
  label,
  identity,
  canReauth,
  confirmDisconnect,
  onReauth,
  onAskDisconnect,
  onCancelDisconnect,
  onConfirmDisconnect,
}: ConnectedAccountProps) => (
  <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-subtle p-4">
    <StatusDot tone="success" size="md" />
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-medium text-foreground">
        {identity ?? 'connected'}
      </span>
      <span className="text-2xs text-muted-foreground">connected</span>
    </div>
    <div className="flex-1" />
    {confirmDisconnect ? (
      <InlineConfirm
        role="alert"
        icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
        title={`Disconnect ${label}?`}
        description="Signs the CLI out on this machine. Connect again to sign back in."
        confirmLabel="Disconnect"
        onConfirm={onConfirmDisconnect}
        onCancel={onCancelDisconnect}
        className="w-80 text-left"
      />
    ) : (
      <>
        {canReauth && (
          <Button variant="secondary" size="sm" onClick={onReauth}>
            Re-authenticate
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onAskDisconnect}
          className={cn('text-danger', tintClasses('danger').hoverBg, 'hover:text-danger')}
        >
          Disconnect
        </Button>
      </>
    )}
  </div>
);
