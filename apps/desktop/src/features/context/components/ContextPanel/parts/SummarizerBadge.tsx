import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { SummarizerStatusKind } from '../lib';

export function SummarizerBadge({
  sessionId,
  status,
  lastUpdate,
  error,
  totals,
  canRetry,
}: {
  sessionId: SessionId;
  status: SummarizerStatusKind;
  lastUpdate: string | null;
  error: string | null;
  totals: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsd: number;
    readonly count: number;
  };
  canRetry: boolean;
}) {
  const retrySummarizer = useAppStore((s) => s.retrySummarizer);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status !== 'error') setRetrying(false);
  }, [status]);

  const costTooltip =
    totals.count === 0
      ? 'summarizer has not run yet'
      : `summary total · ${totals.count} run${totals.count === 1 ? '' : 's'} · ${totals.inputTokens} in / ${totals.outputTokens} out · $${totals.estimatedCostUsd.toFixed(4)}${lastUpdate ? ` · last ${lastUpdate}` : ''}`;

  const costPill = (
    <span
      title={costTooltip}
      className="rounded-full bg-subtle px-2 py-0.5 text-2xs text-muted-foreground"
    >
      Σ ${totals.estimatedCostUsd.toFixed(4)}
    </span>
  );

  if (status === 'running') {
    return (
      <span className="flex items-center gap-1">
        <Loader2 size={10} aria-hidden className="animate-spin text-info" />
        {costPill}
      </span>
    );
  }

  if (status === 'error') {
    const errorTitle = error ? `cannot summarize · ${error}` : 'cannot summarize';
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
          aria-label={canRetry ? 'retry summarizer' : 'summarizer failed'}
          className={cn(
            'inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-2xs uppercase tracking-wide text-danger transition-colors',
            canRetry
              ? 'hover:bg-danger/15 hover:text-danger-foreground/90'
              : 'cursor-not-allowed opacity-70',
          )}
        >
          <AlertTriangle size={10} aria-hidden />
          Cannot summarize
          <RotateCw size={10} aria-hidden className={cn('shrink-0', retrying && 'animate-spin')} />
        </button>
      </span>
    );
  }

  return null;
}
