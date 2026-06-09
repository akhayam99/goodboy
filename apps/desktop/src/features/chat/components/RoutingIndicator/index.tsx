import { useEffect, useState } from 'react';
import type {
  ProviderId,
  RoutingDecision,
  SessionProviderPreference,
  TurnProviderOverride,
} from '@goodboy/types';
import { resolveProviderForTurn } from '../../../../features/providers/routing';
import { SESSION_FEATURES } from '../../../../shared/lib/features';

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
      if (!cancelled) setDecision(d);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionPreference, turnOverride, connectedProviders]);

  if (!decision) return null;
  if (!SESSION_FEATURES.budget) return null;

  if (decision.reason === 'all-exceeded') {
    return (
      <div className="flex items-center gap-2 text-xs text-danger">
        <span>all provider budgets exceeded</span>
        {onSendAnyway ? (
          <button type="button" onClick={onSendAnyway} className="underline hover:no-underline">
            send anyway
          </button>
        ) : null}
      </div>
    );
  }

  const isFallback =
    decision.reason === 'fallback-budget' || decision.reason === 'fallback-disconnected';
  if (!isFallback || !decision.fallbackFrom) return null;

  const label = decision.selectedProvider === 'anthropic' ? 'claude' : decision.selectedProvider;
  const fromLabel = decision.fallbackFrom === 'anthropic' ? 'claude' : decision.fallbackFrom;
  const cause =
    decision.reason === 'fallback-budget'
      ? `budget exceeded for ${fromLabel}`
      : `${fromLabel} disconnected`;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="text-warning">
        ⚠ fallback: {label} / {decision.selectedModel} ({cause})
      </span>
    </div>
  );
};
