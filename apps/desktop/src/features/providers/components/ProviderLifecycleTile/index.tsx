import { useCallback, useState } from 'react';
import { ArrowRight, Loader2, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { brandColor, PROVIDER_BRAND } from '../provider-brand';
import { openProviderModal } from '../ProviderModalHost';
import { CtaButton, intentForState } from './CtaButton';
import { DisconnectControl } from './DisconnectControl';
import { InfoBanner } from './InfoBanner';
import { StatusPill } from './StatusPill';
import { copyFor } from './copy';

interface Props {
  readonly info: ProviderInfo;
}

export function ProviderLifecycleTile({ info }: Props) {
  const providerId = info.id as ProviderId;
  const brand = PROVIDER_BRAND[providerId];
  const Icon: LucideIcon = brand?.icon ?? Sparkles;
  const color = brand ? brandColor(providerId) : 'var(--color-primary)';

  const lifecycle = useAppStore((s) => s.providerLifecycle[providerId]);
  const logoutProvider = useAppStore((s) => s.logoutProvider);
  const cancelLifecycle = useAppStore((s) => s.cancelProviderLifecycle);
  const refreshProviders = useAppStore((s) => s.refreshProviders);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProviders();
    } finally {
      setRefreshing(false);
    }
  }, [refreshProviders]);

  const intent = intentForState(lifecycle.phase, info.connection);

  // Connected providers expose disconnect inline (two-tap confirm, no modal).
  // Everything else routes through the modal.
  const showDisconnectComposite = lifecycle.phase === 'idle' && info.connection === 'connected';
  const inFlight =
    lifecycle.phase === 'installing' ||
    lifecycle.phase === 'connecting' ||
    lifecycle.phase === 'disconnecting';

  const onCtaClick = useCallback(() => {
    if (!intent) return;
    if (intent.action === 'logout') {
      void logoutProvider(providerId);
      return;
    }
    if (intent.action === 'cancel') {
      // Cancel directly from the tile so the user does not have to detour
      // through the modal just to abort. "View progress" remains available
      // as a separate inline button for the watching-only case.
      void cancelLifecycle(providerId);
      return;
    }
    openProviderModal({ providerId, action: intent.action });
  }, [intent, providerId, cancelLifecycle, logoutProvider]);

  return (
    <div
      className="relative flex flex-col gap-2 rounded-lg border bg-subtle p-3 shadow-sm transition-colors"
      style={{
        borderColor: `color-mix(in oklch, ${color} 25%, var(--color-border-soft))`,
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <TileHeader icon={Icon} color={color} info={info} phase={lifecycle.phase} />
        <StatusPill phase={lifecycle.phase} connection={info.connection} />
      </div>

      {lifecycle.phase === 'idle' && lifecycle.action !== 'logout' ? (
        <PreActionCopy providerId={providerId} info={info} />
      ) : null}

      {inFlight ? (
        <InFlightPing
          onClick={() =>
            openProviderModal({
              providerId,
              action: lifecycle.action ?? 'install',
            })
          }
        />
      ) : null}

      <div className="mt-1 w-full">
        {showDisconnectComposite ? (
          <DisconnectControl
            onDisconnect={() => void logoutProvider(providerId)}
            onRefresh={() => void onRefresh()}
            refreshing={refreshing}
            disconnecting={false}
          />
        ) : intent ? (
          <CtaButton intent={intent} onClick={onCtaClick} />
        ) : null}
      </div>
    </div>
  );
}

// TODO (@ak): split file
interface HeaderProps {
  readonly icon: LucideIcon;
  readonly color: string;
  readonly info: ProviderInfo;
  readonly phase: string;
}

function TileHeader({ icon: Icon, color, info, phase }: HeaderProps) {
  const dim = info.connection !== 'connected' && info.connection !== 'error' && phase === 'idle';
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        aria-hidden
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full transition-opacity',
          dim && 'opacity-50',
        )}
        style={{
          backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
          color,
        }}
      >
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="flex flex-col items-center">
        <span className="text-sm font-semibold lowercase">{info.label}</span>
        <span
          className="max-w-[160px] truncate text-2xs text-muted-foreground"
          title={info.identity ?? info.version ?? ''}
        >
          {info.connection === 'connected'
            ? (info.identity ?? 'connected')
            : (info.version ?? info.binary)}
        </span>
      </div>
    </div>
  );
}

function PreActionCopy({ providerId, info }: { providerId: ProviderId; info: ProviderInfo }) {
  const action: ProviderLifecycleAction | null =
    info.connection === 'missing'
      ? 'install'
      : info.connection === 'installed_disconnected'
        ? 'login'
        : null;
  if (!action) return null;
  return <InfoBanner text={copyFor(providerId, action)} />;
}

// TODO (@ak): split file
interface InFlightPingProps {
  readonly onClick: () => void;
}

// Compact "in flight" hint when the lifecycle runs in the background and
// the modal is closed. Clicking it reopens the modal as a viewer over the
// existing PTY (the runId in the slice stays stable across remounts).
function InFlightPing({ onClick }: InFlightPingProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-2xs text-primary transition-colors hover:bg-primary/10"
    >
      <Loader2 size={11} aria-hidden className="animate-spin" />
      <span>View progress</span>
      <ArrowRight size={10} aria-hidden />
    </button>
  );
}
