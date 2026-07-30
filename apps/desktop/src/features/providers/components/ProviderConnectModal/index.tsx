import { useCallback, useEffect, useState } from 'react';
import { Button, Dialog } from '@goodboy/ui';
import { CheckCircle2 } from 'lucide-react';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { PROVIDER_BRAND } from '../provider-brand';
import { CommandPreview } from '../ProviderLifecycleTile/CommandPreview';
import { ErrorPanel } from '../ProviderLifecycleTile/ErrorPanel';
import { InlineTerminal } from '../ProviderLifecycleTile/InlineTerminal';
import { OpenInBrowserButton } from '../ProviderLifecycleTile/OpenInBrowserButton';
import { StatusPill } from '../ProviderLifecycleTile/StatusPill';
import { Stepper } from '../ProviderLifecycleTile/Stepper';
import { EscapeHatch } from './EscapeHatch';
import { GuidePanel } from './GuidePanel';
import { EmptyTerminalPlaceholder, HelperNote, useProviderConnect } from './useProviderConnect';

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
  const { lifecycle, provider, guide, command, inFlight, connected, primary, runPrimary } =
    useProviderConnect(providerId, initialAction, open);

  const onPrimary = useCallback(() => runPrimary(onClose), [runPrimary, onClose]);

  const brand = PROVIDER_BRAND[providerId];
  const Icon = brand.icon;

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
          <Icon
            size={16}
            strokeWidth={2}
            aria-hidden
            className="shrink-0"
            style={{ color: `var(${brand.cssVar})` }}
          />
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
          {!connected && !inFlight && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
          <Button variant={primary.variant} size="sm" onClick={onPrimary}>
            {primary.label}
          </Button>
        </>
      }
      bodyClassName="gap-4 px-6 py-5"
    >
      {command ? <CommandPreview command={command} /> : null}

      {lifecycle.runId ? (
        <InlineTerminal runId={lifecycle.runId} isActive={open} heightClass="min-h-0 flex-1" />
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

      {command ? <EscapeHatch command={command} providerId={providerId} /> : null}
    </Dialog>
  );
}
