import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import type { SessionId, TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';

export const SessionCostChip = ({ sessionId }: { sessionId: SessionId }) => {
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const sessionCost = useMemo(() => {
    let sum = 0;
    for (const rec of telemetry) {
      if (rec.kind === 'summarizer') {
        continue;
      }
      sum += rec.estimatedCostUsd;
    }
    return sum;
  }, [telemetry]);
  const label = sessionCost === 0 ? '$0' : `$${sessionCost.toFixed(2)}`;

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
