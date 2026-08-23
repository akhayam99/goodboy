import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn, formatUsd } from '@goodboy/ui';
import type { SessionId, TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSummarizerStatus } from '../../../../store';
import { SummarizerWorkingIndicator } from '../SummarizerWorkingIndicator';

export const SummarizerBadge = ({ sessionId }: { sessionId: SessionId }) => {
  const { status, lastUpdate, error, lastAttempt } = useSummarizerStatus(sessionId);
  const canRetry = lastAttempt !== null;
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const retrySummarizer = useAppStore((s) => s.retrySummarizer);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status !== 'error') setRetrying(false);
  }, [status]);

  const totals = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let estimatedCostUsd = 0;
    let count = 0;
    for (const rec of telemetry) {
      if (rec.kind !== 'summarizer') continue;
      inputTokens += rec.inputTokens;
      outputTokens += rec.outputTokens;
      estimatedCostUsd += rec.estimatedCostUsd;
      count += 1;
    }
    return { inputTokens, outputTokens, estimatedCostUsd, count };
  }, [telemetry]);

  const costTooltip =
    totals.count === 0
      ? 'Summarizer has not run yet'
      : `Summary total · ${totals.count} run${totals.count === 1 ? '' : 's'} · ${totals.inputTokens} in / ${totals.outputTokens} out · ${formatUsd(totals.estimatedCostUsd)}${lastUpdate ? ` · last ${lastUpdate}` : ''}`;

  const costPill = (
    <span
      title={costTooltip}
      className="inline-flex h-6 shrink-0 items-center text-2xs tabular-nums text-muted-foreground"
    >
      Σ {formatUsd(totals.estimatedCostUsd)}
    </span>
  );

  if (status === 'running') {
    return (
      <span className="flex items-center gap-1">
        <SummarizerWorkingIndicator />
        {costPill}
      </span>
    );
  }

  if (status === 'error') {
    const errorTitle = error ? `Cannot summarize · ${error}` : 'Cannot summarize';
    return (
      <span className="flex items-center gap-1">
        {costPill}
        <button
          type="button"
          onClick={() => {
            if (!canRetry || retrying) return;
            setRetrying(true);
            retrySummarizer(sessionId);
          }}
          disabled={!canRetry}
          title={canRetry ? `${errorTitle}, click to retry` : errorTitle}
          aria-label={canRetry ? 'Retry summarizer' : 'Summarizer failed'}
          className={cn(
            'inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-danger/10 px-2 text-2xs text-danger motion-safe:transition-colors',
            retrying && 'animate-border-pulse',
            canRetry
              ? 'hover:bg-danger/15 hover:text-danger-foreground/90'
              : 'cursor-not-allowed opacity-70',
          )}
        >
          <AlertTriangle size={10} aria-hidden />
          Cannot summarize
          <RotateCw size={10} aria-hidden className="shrink-0" />
        </button>
      </span>
    );
  }

  if (status === 'idle') return totals.count > 0 ? costPill : null;

  return null;
};
