import { useEffect, useRef, useState } from 'react';
import { cn, formatUsd } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useSessionCost } from '../../../../store';

export const SessionCostChip = ({ sessionId }: { sessionId: SessionId }) => {
  const sessionCost = useSessionCost(sessionId);
  const label = formatUsd(sessionCost);

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
      title={`Estimated cost for this session: ${label} (excluding summarizer), click for budget studio`}
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
