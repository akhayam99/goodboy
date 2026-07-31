import { Button, Divider, ScrollFade } from '@goodboy/ui';
import { ArrowLeft } from 'lucide-react';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { PROVIDER_BRAND } from '../provider-brand';
import { CommandPreview } from '../ProviderLifecycleTile/CommandPreview';
import { ErrorPanel } from '../ProviderLifecycleTile/ErrorPanel';
import { InlineTerminal } from '../ProviderLifecycleTile/InlineTerminal';
import { OpenInBrowserButton } from '../ProviderLifecycleTile/OpenInBrowserButton';
import { StatusPill } from '../ProviderLifecycleTile/StatusPill';
import { Stepper } from '../ProviderLifecycleTile/Stepper';
import { EscapeHatch } from '../ProviderConnectModal/EscapeHatch';
import { GuidePanel } from '../ProviderConnectModal/GuidePanel';
import {
  EmptyTerminalPlaceholder,
  HelperNote,
  useProviderConnect,
} from '../ProviderConnectModal/useProviderConnect';

export type ProviderConnectChrome = 'studio' | 'modal';

type Props = {
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
  readonly autoStart: boolean;
  readonly chrome?: ProviderConnectChrome;
  readonly onBack: () => void;
};

export const ProviderConnectPane = ({
  providerId,
  action,
  autoStart,
  chrome = 'studio',
  onBack,
}: Props) => {
  const { lifecycle, provider, guide, command, inFlight, connected, primary, runPrimary } =
    useProviderConnect(providerId, action, autoStart);

  const brand = PROVIDER_BRAND[providerId];
  const Icon = brand.icon;
  const isModal = chrome === 'modal';
  const actions = (
    <>
      {!connected && !inFlight && !isModal ? (
        <Button variant="ghost" size="sm" onClick={onBack}>
          Close
        </Button>
      ) : null}
      <Button variant={primary.variant} size="sm" onClick={() => runPrimary(onBack)}>
        {primary.label}
      </Button>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!isModal && (
        <>
          <div className="flex items-center gap-3 px-8 py-4">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to account"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft size={16} aria-hidden />
            </button>
            <Icon
              size={18}
              strokeWidth={2}
              aria-hidden
              className="shrink-0"
              style={{ color: `var(${brand.cssVar})` }}
            />
            <span className="text-base font-semibold lowercase text-foreground">
              {provider?.label ?? providerId}
            </span>
            <StatusPill phase={lifecycle.phase} connection={provider?.connection ?? 'missing'} />
            <div className="flex-1" />
            {actions}
          </div>
          <Divider />
        </>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-8 py-5">
          {lifecycle.action ? <Stepper action={lifecycle.action} /> : null}
          {command ? <CommandPreview command={command} /> : null}

          {lifecycle.runId ? (
            <InlineTerminal runId={lifecycle.runId} isActive heightClass="min-h-0 flex-1" />
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
        </div>
        <Divider orientation="vertical" />
        <ScrollFade
          className="w-72 shrink-0"
          viewportClassName="bg-subtle/30 px-5 py-5"
          fadeFrom="subtle"
        >
          <GuidePanel guide={guide} />
        </ScrollFade>
      </div>

      {isModal && (
        <>
          <Divider />
          <div className="flex shrink-0 items-center justify-end gap-2 px-6 py-3">{actions}</div>
        </>
      )}
    </div>
  );
};
