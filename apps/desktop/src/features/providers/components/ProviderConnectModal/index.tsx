import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, Button } from '@goodboy/ui';
import { CheckCircle2, Info } from 'lucide-react';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ProviderLifecyclePhase } from '../../../../store/slices/providers';
import { resolveLifecycleCommand } from '../../provider-lifecycle';
import { brandColor, PROVIDER_BRAND } from '../provider-brand';
import { CommandPreview } from '../ProviderLifecycleTile/CommandPreview';
import { ErrorPanel } from '../ProviderLifecycleTile/ErrorPanel';
import { InlineTerminal } from '../ProviderLifecycleTile/InlineTerminal';
import { OpenInBrowserButton } from '../ProviderLifecycleTile/OpenInBrowserButton';
import { StatusPill } from '../ProviderLifecycleTile/StatusPill';
import { Stepper } from '../ProviderLifecycleTile/Stepper';
import { EscapeHatch } from './EscapeHatch';
import { GuidePanel } from './GuidePanel';
import { guideFor } from './guides';

type Props = {
  readonly providerId: ProviderId | null;
  readonly initialAction: ProviderLifecycleAction;
  readonly onClose: () => void;
};

export const ProviderConnectModal = ({ providerId, initialAction, onClose }: Props) => {
  const open = providerId !== null;
  const [pinned, setPinned] = useState<ProviderId | null>(null);
  const [pinnedAction, setPinnedAction] = useState<ProviderLifecycleAction>(initialAction);

  useEffect(() => {
    if (providerId) {
      setPinned(providerId);
      setPinnedAction(initialAction);
    }
  }, [providerId, initialAction]);

  const target = providerId ?? pinned;
  if (!target) {
    return (
      <Dialog open={false} onClose={onClose} size="xl">
        {null}
      </Dialog>
    );
  }
  return (
    <ModalBody providerId={target} initialAction={pinnedAction} open={open} onClose={onClose} />
  );
};

type BodyProps = {
  readonly providerId: ProviderId;
  readonly initialAction: ProviderLifecycleAction;
  readonly open: boolean;
  readonly onClose: () => void;
};

function ModalBody({ providerId, initialAction, open, onClose }: BodyProps) {
  const lifecycle = useAppStore((s) => s.providerLifecycle[providerId]);
  const provider = useAppStore((s) => s.providers.find((p) => p.id === providerId));
  const installProvider = useAppStore((s) => s.installProvider);
  const loginProvider = useAppStore((s) => s.loginProvider);
  const cancelLifecycle = useAppStore((s) => s.cancelProviderLifecycle);

  const [didAutoStart, setDidAutoStart] = useState(false);

  useEffect(() => {
    if (!open) {
      setDidAutoStart(false);
      return;
    }
    if (didAutoStart) {
      return;
    }
    const resting: ReadonlyArray<ProviderLifecyclePhase> = [
      'idle',
      'cancelled',
      'error',
      'installed',
      'connected',
    ];
    if (!resting.includes(lifecycle.phase)) {
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
    open,
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

  const onPrimary = useCallback(() => {
    if (inFlight) {
      void cancelLifecycle(providerId);
      return;
    }
    if (connected) {
      onClose();
      return;
    }
    if (!installed) {
      void installProvider(providerId);
    } else {
      void loginProvider(providerId);
    }
  }, [
    inFlight,
    connected,
    installed,
    providerId,
    cancelLifecycle,
    installProvider,
    loginProvider,
    onClose,
  ]);

  const primary = primaryButton(lifecycle.phase, connected, installed, inFlight);
  const brand = PROVIDER_BRAND[providerId];
  const Icon = brand.icon;
  const color = brandColor(providerId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      panel={<GuidePanel guide={guide} />}
      panelWidthClass="w-72"
      panelClassName="bg-subtle/30 px-5 py-5 overflow-y-auto"
      title={
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{
              backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
              color,
            }}
          >
            <Icon size={14} strokeWidth={2} />
          </span>
          <span className="lowercase">{provider?.label ?? providerId}</span>
          <StatusPill phase={lifecycle.phase} connection={provider?.connection ?? 'missing'} />
        </span>
      }
      description={
        lifecycle.action ? (
          <Stepper action={lifecycle.action} />
        ) : connected ? (
          <span className="inline-flex items-center gap-1.5 text-success">
            <CheckCircle2 size={12} aria-hidden />
            <span>Connected as {provider?.identity ?? 'this account'}</span>
          </span>
        ) : (
          'Step through install and sign-in without leaving Goodboy.'
        )
      }
      footer={
        <>
          {!connected && !inFlight ? (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          ) : null}
          <Button variant={primary.variant} size="sm" onClick={onPrimary}>
            {primary.label}
          </Button>
        </>
      }
      bodyClassName="gap-4 px-6 py-5"
    >
      {command ? <CommandPreview command={command} /> : null}

      {lifecycle.runId ? (
        <InlineTerminal runId={lifecycle.runId} isActive={open} heightClass="h-72" />
      ) : (
        <EmptyTerminalPlaceholder connected={connected} />
      )}

      <HelperNote inFlight={inFlight} />

      {lifecycle.detectedAuthUrl ? (
        <div className="flex justify-center">
          <OpenInBrowserButton url={lifecycle.detectedAuthUrl} />
        </div>
      ) : null}

      {lifecycle.phase === 'error' && lifecycle.errorTail ? (
        <ErrorPanel tail={lifecycle.errorTail} />
      ) : null}

      {command ? <EscapeHatch command={command} /> : null}
    </Dialog>
  );
}

type PrimaryButton = {
  readonly label: string;
  readonly variant: 'primary' | 'secondary' | 'ghost' | 'danger';
};

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

function HelperNote({ inFlight }: { inFlight: boolean }) {
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

function EmptyTerminalPlaceholder({ connected }: { connected: boolean }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-border-soft bg-subtle/30 text-2xs text-muted-foreground">
      {connected
        ? 'You are already connected. The next sign-in or reinstall will run here.'
        : 'Terminal will appear when the command starts running.'}
    </div>
  );
}
