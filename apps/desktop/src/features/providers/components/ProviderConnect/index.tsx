import { useEffect, useRef } from 'react';
import { Button, Collapsible, cn } from '@goodboy/ui';
import { CheckCircle2 } from 'lucide-react';
import { PROVIDER_CONNECT_CAPABILITIES, type ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openUrl } from '../../../../shared/lib/editor';
import { PROVIDER_LABEL_LOWER } from '../../providers';
import { PROVIDER_BRAND } from '../provider-brand';
import { guideFor } from '../ProviderConnectModal/guides';
import { ConnectDetails } from './ConnectDetails';
import { ManualNote } from './ManualNote';
import { TrustNote } from './TrustNote';
import { connectView, type ProviderConnectChrome } from './connectView';
import { useConnectDetails } from './useConnectDetails';

type Props = {
  readonly providerId: ProviderId;
  readonly chrome: ProviderConnectChrome;
  readonly autoStart?: boolean;
  readonly onDone: () => void;
};

export const ProviderConnect = ({ providerId, chrome, autoStart = false, onDone }: Props) => {
  const connect = useAppStore((s) => s.providerConnect[providerId]);
  const connectProvider = useAppStore((s) => s.connectProvider);
  const cancelProviderConnect = useAppStore((s) => s.cancelProviderConnect);
  const dismissProviderConnect = useAppStore((s) => s.dismissProviderConnect);

  const startedRef = useRef<ProviderId | null>(null);

  const capability = PROVIDER_CONNECT_CAPABILITIES[providerId];
  const label = PROVIDER_LABEL_LOWER[providerId];
  const guide = guideFor(providerId, connect.step ?? 'login');
  const view = connectView({
    phase: connect.phase,
    step: connect.step,
    providerLabel: label,
    identity: connect.identity,
    chrome,
  });
  const details = useConnectDetails({ autoOpenPhase: view.autoDetails ? connect.phase : null });

  useEffect(() => {
    if (!autoStart || startedRef.current === providerId) {
      return;
    }
    if (capability.tier === 'manual') {
      return;
    }
    if (connect.phase !== 'idle' && connect.phase !== 'cancelled') {
      return;
    }
    startedRef.current = providerId;
    void connectProvider(providerId);
  }, [autoStart, capability.tier, connect.phase, connectProvider, providerId]);

  if (capability.tier === 'manual') {
    return (
      <section aria-label={`Connect ${label}`} className="flex flex-col gap-4">
        <ManualNote
          reason={capability.manualReason ?? guide.headline}
          docsUrl={guide.docsUrl}
          docsLabel={guide.docsLabel}
        />
        <TrustNote />
      </section>
    );
  }

  const showDetails = view.hasDetails || (details.engaged && details.open);
  const Mark = PROVIDER_BRAND[providerId].icon;
  const { authUrl } = connect;

  const onPrimary = () => {
    if (view.primary === 'cancel') {
      void cancelProviderConnect(providerId);
      return;
    }
    if (view.primary === 'done') {
      dismissProviderConnect(providerId);
      onDone();
      return;
    }
    void connectProvider(providerId);
  };

  return (
    <section aria-label={`Connect ${label}`} className="flex flex-col gap-4">
      <div
        className={cn(
          'flex items-start gap-3 rounded-lg border border-border-soft bg-subtle/30 p-4',
          view.isRunning && 'spin-border spin-border-info',
        )}
      >
        {view.isSuccess ? (
          <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0 text-success" />
        ) : (
          <Mark
            size={18}
            strokeWidth={2}
            aria-hidden
            className="mt-0.5 shrink-0"
            style={{ color: `var(${PROVIDER_BRAND[providerId].cssVar})` }}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {chrome === 'inline' ? `Connect ${label}` : label}
          </span>
          {view.status !== null && (
            <span className="max-w-prose text-xs leading-relaxed text-muted-foreground">
              {view.status}
            </span>
          )}
          {view.note !== null && (
            <span className="max-w-prose text-2xs leading-relaxed text-muted-foreground">
              {view.note}
            </span>
          )}
          {view.isFailure && connect.errorTail !== null && (
            <span className="max-w-prose break-words text-2xs leading-relaxed text-danger">
              {connect.errorTail}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {view.showAuthLink && authUrl !== null && (
            <Button variant="ghost" size="sm" onClick={() => void openUrl(authUrl)}>
              Open the link again
            </Button>
          )}
          {view.primaryLabel !== null && (
            <Button
              variant={view.primary === 'cancel' ? 'secondary' : 'primary'}
              size="sm"
              onClick={onPrimary}
            >
              {view.primaryLabel}
            </Button>
          )}
        </div>
      </div>

      {view.showTerminalHint && connect.command !== null && (
        <p className="max-w-prose text-2xs leading-relaxed text-muted-foreground">
          If this keeps failing, run{' '}
          <span className="font-mono text-foreground">{connect.command}</span> in your terminal,
          then come back.
        </p>
      )}

      {showDetails && (
        <Collapsible
          open={details.open}
          onOpenChange={details.setOpen}
          trigger={
            <span className="text-xs">{details.open ? 'Hide details' : 'Show details'}</span>
          }
        >
          <div ref={details.regionRef} onFocus={details.onFocus} onBlur={details.onBlur}>
            <ConnectDetails
              providerId={providerId}
              runId={connect.runId}
              command={connect.command}
              guide={guide}
            />
          </div>
        </Collapsible>
      )}

      <TrustNote />
    </section>
  );
};
