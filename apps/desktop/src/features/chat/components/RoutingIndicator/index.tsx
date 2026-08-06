import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type {
  ProviderId,
  RoutingDecision,
  RoutingReason,
  SessionProviderPreference,
  TurnProviderOverride,
} from '@goodboy/types';
import { resolveProviderForTurn } from '../../../../features/providers/routing';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { SESSION_FEATURES } from '../../../../shared/lib/features';
import { PROVIDER_LABEL } from '../../utils/chat-constants';
import { tintClasses } from '@goodboy/ui';
import { TranscriptShell } from '../TranscriptShell';

const warningAccent = tintClasses('warning');

type Props = {
  readonly sessionPreference: SessionProviderPreference;
  readonly turnOverride: TurnProviderOverride | undefined;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onSendAnyway?: () => void;
};

export const RoutingIndicator = ({
  sessionPreference,
  turnOverride,
  connectedProviders,
  onSendAnyway,
}: Props) => {
  const [decision, setDecision] = useState<RoutingDecision | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveProviderForTurn({
      sessionPreference,
      turnOverride,
      connectedProviders: [...connectedProviders],
    }).then((d) => {
      if (!cancelled) {
        setDecision(d);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionPreference, turnOverride, connectedProviders]);

  if (!decision) {
    return null;
  }
  if (!SESSION_FEATURES.budget) {
    return null;
  }

  if (decision.reason === 'all-exceeded') {
    return (
      <TranscriptShell
        tone="warning"
        variant="boxed"
        className={`flex items-center gap-2 text-xs ${warningAccent.text}`}
      >
        <AlertTriangle size={13} aria-hidden className="shrink-0" />
        <span className="flex-1">All provider budgets exceeded</span>
        {onSendAnyway !== undefined ? (
          <button
            type="button"
            onClick={onSendAnyway}
            className={`shrink-0 rounded-md border px-2 py-0.5 font-medium transition-colors ${warningAccent.border} ${warningAccent.hoverBg} ${warningAccent.text}`}
          >
            Send anyway
          </button>
        ) : null}
      </TranscriptShell>
    );
  }

  const isFallback =
    decision.reason === 'fallback-budget' ||
    decision.reason === 'fallback-threshold' ||
    decision.reason === 'fallback-disconnected';
  if (!isFallback || !decision.fallbackFrom) {
    return null;
  }

  const fromLabel = PROVIDER_LABEL[decision.fallbackFrom];
  const causeByReason: Partial<Record<RoutingReason, string>> = {
    'fallback-budget': `Budget exceeded for ${fromLabel}`,
    'fallback-threshold': `${fromLabel} past its budget threshold`,
    'fallback-disconnected': `${fromLabel} disconnected`,
  };
  const cause = causeByReason[decision.reason] ?? `${fromLabel} disconnected`;

  return (
    <TranscriptShell
      tone="warning"
      variant="boxed"
      className={`flex w-fit items-center gap-1.5 text-xs ${warningAccent.text}`}
    >
      <AlertTriangle size={13} aria-hidden className="shrink-0" />
      <span className="flex items-center gap-1.5">
        Fallback to
        <RoutingBadge provider={decision.selectedProvider} model={decision.selectedModel} />
        <span>({cause})</span>
      </span>
    </TranscriptShell>
  );
};
