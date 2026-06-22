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
  const finalLabel = sessionCost === 0 ? '$0' : `$${sessionCost.toFixed(2)}`;

  const [displayLabel, setDisplayLabel] = useState(finalLabel);
  const [animating, setAnimating] = useState(false);
  const prevCostRef = useRef(sessionCost);
  const prevSessionIdRef = useRef(sessionId);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      prevCostRef.current = sessionCost;
      setDisplayLabel(finalLabel);
      setAnimating(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    if (prevCostRef.current === sessionCost) {
      setDisplayLabel(finalLabel);
      return;
    }
    const fromCost = prevCostRef.current;
    const toCost = sessionCost;
    prevCostRef.current = toCost;

    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayLabel(finalLabel);
      setAnimating(false);
      return;
    }

    setAnimating(true);
    const duration = 1100;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = fromCost + (toCost - fromCost) * eased;
      setDisplayLabel(current === 0 ? '$0' : `$${current.toFixed(2)}`);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setDisplayLabel(finalLabel);
        setAnimating(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [sessionCost, sessionId, finalLabel]);

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
      title={`Estimated cost for this session: ${finalLabel} (excluding summarizer), click for budget studio`}
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border border-success/20 bg-success/10 px-2 py-1 font-mono text-2xs text-success transition-colors hover:border-success/40 hover:bg-success/15',
        animating && 'cost-chip-pulse',
      )}
    >
      {displayLabel}
    </button>
  );
};
