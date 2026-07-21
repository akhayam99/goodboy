import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type {
  ProviderId,
  RoutingDecision,
  SessionProviderPreference,
  TurnProviderOverride,
} from '@goodboy/types';
import { resolveProviderForTurn } from '../../../../features/providers/routing';
import { SESSION_FEATURES } from '../../../../shared/lib/features';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptShell } from '../TranscriptShell';

const dangerAccent = MARKER_ACCENT.danger;
const warningAccent = MARKER_ACCENT.warning;

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
    resolveProviderForTurn(sessionPreference, turnOverride, [...connectedProviders]).then((d) => {
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
        tone="danger"
        variant="boxed"
        className={`flex items-center gap-2 text-xs ${dangerAccent.text}`}
      >
        <AlertTriangle size={13} aria-hidden className="shrink-0" />
        <span className="flex-1">all provider budgets exceeded</span>
        {onSendAnyway ? (
          <button
            type="button"
            onClick={onSendAnyway}
            className={`shrink-0 rounded border px-2 py-0.5 font-medium transition-opacity hover:opacity-80 ${dangerAccent.border} ${dangerAccent.text}`}
          >
            send anyway
          </button>
        ) : null}
      </TranscriptShell>
    );
  }

  const isFallback =
    decision.reason === 'fallback-budget' || decision.reason === 'fallback-disconnected';
  if (!isFallback || !decision.fallbackFrom) {
    return null;
  }

  const label = decision.selectedProvider === 'anthropic' ? 'claude' : decision.selectedProvider;
  const fromLabel = decision.fallbackFrom === 'anthropic' ? 'claude' : decision.fallbackFrom;
  const cause =
    decision.reason === 'fallback-budget'
      ? `budget exceeded for ${fromLabel}`
      : `${fromLabel} disconnected`;

  return (
    <TranscriptShell
      tone="warning"
      variant="boxed"
      className={`flex w-fit items-center gap-1.5 text-xs ${warningAccent.text}`}
    >
      <AlertTriangle size={13} aria-hidden className="shrink-0" />
      <span>
        fallback: {label} / {decision.selectedModel} ({cause})
      </span>
    </TranscriptShell>
  );
};
