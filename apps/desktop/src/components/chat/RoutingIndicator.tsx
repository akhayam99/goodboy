import { useEffect, useState } from 'react';
import type {
  ProviderId,
  RoutingDecision,
  SessionProviderPreference,
  TurnProviderOverride,
} from '@kay-am/types';
import { resolveProviderForTurn } from '../../routing';

interface RoutingIndicatorProps {
  readonly sessionPreference: SessionProviderPreference;
  readonly turnOverride: TurnProviderOverride | undefined;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onSendAnyway?: () => void;
}

export function RoutingIndicator({
  sessionPreference,
  turnOverride,
  connectedProviders,
  onSendAnyway,
}: RoutingIndicatorProps) {
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

  const label = decision.selectedProvider === 'anthropic' ? 'claude' : decision.selectedProvider;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {decision.reason === 'fallback-budget' && decision.fallbackFrom ? (
        <span className="text-warning">
          ⚠ fallback: {label} / {decision.selectedModel} (budget exceeded for{' '}
          {decision.fallbackFrom === 'anthropic' ? 'claude' : decision.fallbackFrom})
        </span>
      ) : (
        <>
          <span>
            {label} / {decision.selectedModel}
          </span>
          {decision.reason === 'override' ? (
            <span className="rounded bg-accent px-1 py-0.5 text-[10px] font-medium text-accent-foreground">
              override
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
