import { useEffect, useRef, useState } from 'react';
import { cn, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useSessionCost } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
};

export const SessionCostChip = ({ sessionId }: Props) => {
  const sessionCost = useSessionCost(sessionId);
  const capUsd = useAppStore(
    (state) =>
      state.budgetAlerts.find(
        (alert) =>
          alert.sessionId === sessionId &&
          (alert.kind === 'session-threshold' || alert.kind === 'session-exceeded'),
      )?.capUsd ?? null,
  );
  const spent = formatUsd(sessionCost);
  const label = capUsd != null ? `${spent} / ${formatUsd(capUsd)}` : spent;
  const title =
    capUsd != null
      ? `Estimated cost for this session: ${formatUsdPrecise(sessionCost)} of a ${formatUsdPrecise(capUsd)} cap (excluding summarizer), click for budget studio`
      : `Estimated cost for this session: ${formatUsdPrecise(sessionCost)} (excluding summarizer), click for budget studio`;

  const [pulse, setPulse] = useState(false);
  const prevCostRef = useRef(sessionCost);
  const prevSessionIdRef = useRef(sessionId);

  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      prevCostRef.current = sessionCost;
      setPulse(false);
      return;
    }
    if (prevCostRef.current === sessionCost) {
      return;
    }
    prevCostRef.current = sessionCost;
    setPulse(true);
  }, [sessionCost, sessionId]);

  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent('goodboy:open-budget-studio', {
            detail: { scope: { kind: 'session', sessionId } },
          }),
        )
      }
      title={title}
      onAnimationEnd={() => setPulse(false)}
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border border-border-soft bg-muted px-2 py-1 font-mono text-2xs tabular-nums text-muted-foreground transition-colors hover:border-border hover:text-foreground',
        pulse && 'cost-chip-pulse',
      )}
    >
      {label}
    </button>
  );
};
