import { useCallback, useState } from 'react';
import { Code2, Gem, MousePointer2, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { CommandPreview } from './CommandPreview';
import { CtaButton, intentForState } from './CtaButton';
import { DisconnectControl } from './DisconnectControl';
import { ErrorPanel } from './ErrorPanel';
import { InfoBanner } from './InfoBanner';
import { InlineTerminal } from './InlineTerminal';
import { OpenInBrowserButton } from './OpenInBrowserButton';
import { StatusPill } from './StatusPill';
import { Stepper } from './Stepper';
import { copyFor } from './copy';

interface ProviderBrand {
  readonly icon: LucideIcon;
  readonly cssVar: string;
}

const PROVIDER_BRAND: Record<ProviderId, ProviderBrand> = {
  anthropic: { icon: Sparkles, cssVar: '--color-provider-anthropic' },
  cursor: { icon: MousePointer2, cssVar: '--color-provider-cursor' },
  codex: { icon: Code2, cssVar: '--color-provider-codex' },
  gemini: { icon: Gem, cssVar: '--color-provider-gemini' },
};

interface Props {
  readonly info: ProviderInfo;
}

// In-flight phases drive the wide layout (col-span-full with terminal).
const WIDE_PHASES = new Set(['installing', 'connecting', 'disconnecting']);

export function ProviderLifecycleTile({ info }: Props) {
  const providerId = info.id as ProviderId;
  const brand = PROVIDER_BRAND[providerId];
  const Icon = brand?.icon ?? Sparkles;
  const color = brand ? `var(${brand.cssVar})` : 'var(--color-primary)';

  const lifecycle = useAppStore((s) => s.providerLifecycle[providerId]);
  const installProvider = useAppStore((s) => s.installProvider);
  const loginProvider = useAppStore((s) => s.loginProvider);
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

  const fireAction = useCallback(
    (action: ProviderLifecycleAction | 'cancel') => {
      if (action === 'install') void installProvider(providerId);
      else if (action === 'login') void loginProvider(providerId);
      else if (action === 'logout') void logoutProvider(providerId);
      else if (action === 'cancel') void cancelLifecycle(providerId);
    },
    [providerId, installProvider, loginProvider, logoutProvider, cancelLifecycle],
  );

  const isWide = WIDE_PHASES.has(lifecycle.phase);
  const intent = intentForState(lifecycle.phase, info.connection);

  // The connected state with a stable connection gets its own composite
  // (refresh + two-tap disconnect) rather than a single CTA button.
  const showDisconnectComposite = lifecycle.phase === 'idle' && info.connection === 'connected';

  return (
    <div
      className="relative flex flex-col gap-2 rounded-lg border bg-subtle p-3 shadow-sm transition-colors"
      style={{
        borderColor: `color-mix(in oklch, ${color} 25%, var(--color-border-soft))`,
        gridColumn: isWide ? '1 / -1' : undefined,
      }}
    >
      <div
        className={cn(
          'flex items-start gap-3',
          isWide ? 'justify-between' : 'flex-col items-center',
        )}
      >
        <TileHeader
          icon={Icon}
          color={color}
          info={info}
          phase={lifecycle.phase}
          stacked={!isWide}
        />
        {isWide ? (
          <div className="flex flex-col items-end gap-1">
            <StatusPill phase={lifecycle.phase} connection={info.connection} />
            {lifecycle.action ? <Stepper action={lifecycle.action} /> : null}
          </div>
        ) : (
          <StatusPill phase={lifecycle.phase} connection={info.connection} />
        )}
      </div>

      {isWide && lifecycle.command ? <CommandPreview command={lifecycle.command} /> : null}

      {isWide && lifecycle.runId ? <InlineTerminal runId={lifecycle.runId} isActive /> : null}

      {isWide && lifecycle.detectedAuthUrl ? (
        <div className="flex justify-center">
          <OpenInBrowserButton url={lifecycle.detectedAuthUrl} />
        </div>
      ) : null}

      {lifecycle.phase === 'error' && lifecycle.errorTail ? (
        <ErrorPanel tail={lifecycle.errorTail} />
      ) : null}

      {!isWide && lifecycle.phase === 'idle' && lifecycle.action !== 'logout' ? (
        <PreActionCopy providerId={providerId} info={info} />
      ) : null}

      <div className="mt-1 w-full">
        {showDisconnectComposite ? (
          <DisconnectControl
            onDisconnect={() => fireAction('logout')}
            onRefresh={() => void onRefresh()}
            refreshing={refreshing}
            disconnecting={false}
          />
        ) : intent ? (
          <CtaButton intent={intent} onClick={() => fireAction(intent.action)} />
        ) : null}
      </div>
    </div>
  );
}

interface HeaderProps {
  readonly icon: LucideIcon;
  readonly color: string;
  readonly info: ProviderInfo;
  readonly phase: string;
  readonly stacked: boolean;
}

function TileHeader({ icon: Icon, color, info, phase, stacked }: HeaderProps) {
  const dim = info.connection !== 'connected' && info.connection !== 'error' && phase === 'idle';
  return (
    <div className={cn('flex items-center gap-2.5', stacked && 'flex-col gap-2')}>
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
      <div className={cn('flex flex-col', stacked ? 'items-center' : 'items-start')}>
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
