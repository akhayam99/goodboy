import { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { EmptyState } from '@goodboy/ui';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ProviderLifecyclePhase } from '../../../../store/slices/providers';
import { resolveLifecycleCommand } from '../../provider-lifecycle';
import { guideFor } from './guides';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

export type PrimaryButton = {
  readonly label: string;
  readonly variant: 'primary' | 'secondary' | 'ghost' | 'danger';
};

const RESTING_PHASES: ReadonlyArray<ProviderLifecyclePhase> = [
  'idle',
  'cancelled',
  'error',
  'installed',
  'connected',
];

export function useProviderConnect(
  providerId: ProviderId,
  initialAction: ProviderLifecycleAction,
  active: boolean,
) {
  const lifecycle = useAppStore((s) => s.providerLifecycle[providerId]);
  const provider = useAppStore((s) => s.providers.find((p) => p.id === providerId));
  const installProvider = useAppStore((s) => s.installProvider);
  const loginProvider = useAppStore((s) => s.loginProvider);
  const cancelLifecycle = useAppStore((s) => s.cancelProviderLifecycle);

  const [didAutoStart, setDidAutoStart] = useState(false);

  useEffect(() => {
    if (!active) {
      setDidAutoStart(false);
      return;
    }
    if (didAutoStart) {
      return;
    }
    if (!RESTING_PHASES.includes(lifecycle.phase)) {
      return;
    }
    if (initialAction === 'install' && provider?.connection !== 'missing') {
      return;
    }
    if (initialAction === 'login' && provider?.connection === 'connected') {
      return;
    }
    setDidAutoStart(true);
    if (initialAction === 'install') {
      void installProvider(providerId);
    } else if (initialAction === 'login') {
      void loginProvider(providerId);
    }
  }, [
    active,
    didAutoStart,
    initialAction,
    lifecycle.phase,
    provider?.connection,
    providerId,
    installProvider,
    loginProvider,
  ]);

  const currentAction: ProviderLifecycleAction = lifecycle.action ?? initialAction;
  const guide = useMemo(() => guideFor(providerId, currentAction), [providerId, currentAction]);
  const command = lifecycle.command ?? resolveLifecycleCommand(providerId, currentAction);

  const inFlight =
    lifecycle.phase === 'installing' ||
    lifecycle.phase === 'connecting' ||
    lifecycle.phase === 'disconnecting';
  const connected = provider?.connection === 'connected';
  const installed = provider !== undefined && provider.connection !== 'missing';

  const runPrimary = (onDone: () => void) => {
    if (inFlight) {
      void cancelLifecycle(providerId);
      return;
    }
    if (connected) {
      onDone();
      return;
    }
    if (!installed) {
      void installProvider(providerId);
    } else {
      void loginProvider(providerId);
    }
  };

  const primary = primaryButton(lifecycle.phase, connected, installed, inFlight);

  return {
    lifecycle,
    provider,
    guide,
    command,
    inFlight,
    connected,
    installed,
    primary,
    runPrimary,
  };
}

function primaryButton(
  phase: ProviderLifecyclePhase,
  connected: boolean,
  installed: boolean,
  inFlight: boolean,
): PrimaryButton {
  if (inFlight) {
    return { label: 'Cancel', variant: 'secondary' };
  }
  if (connected) {
    return { label: 'Done', variant: 'primary' };
  }
  if (phase === 'error') {
    if (!installed) {
      return { label: 'Retry install', variant: 'primary' };
    }
    return { label: 'Retry sign-in', variant: 'primary' };
  }
  if (!installed) {
    return { label: 'Install', variant: 'primary' };
  }
  return { label: 'Sign in', variant: 'primary' };
}

export function HelperNote({ inFlight }: { readonly inFlight: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border-soft bg-subtle/30 px-3 py-2 text-2xs text-muted-foreground">
      <Info size={12} aria-hidden className="mt-0.5 shrink-0" />
      <span className="leading-relaxed">
        {inFlight
          ? 'If the install or sign-in pauses, click inside the terminal and type. It accepts keyboard input directly, exactly like your own shell.'
          : 'The embedded terminal accepts keyboard input. Click in it and type if a step needs a password or a menu choice.'}
      </span>
    </div>
  );
}

export function EmptyTerminalPlaceholder({ connected }: { readonly connected: boolean }) {
  return (
    <EmptyState
      bordered
      icon={CONCEPT_ICONS.terminal}
      title={
        connected
          ? 'You are already connected. The next sign-in or reinstall will run here.'
          : 'Terminal will appear when the command starts running.'
      }
      size="inline"
      className="min-h-0 flex-1 items-center justify-center bg-subtle/30 p-3"
    />
  );
}
