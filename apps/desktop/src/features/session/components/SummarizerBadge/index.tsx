import { useEffect, useState } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useSummarizerStatus } from '../../../../store';
import { SummarizerWorkingIndicator } from '../SummarizerWorkingIndicator';

export const SummarizerBadge = ({ sessionId }: { sessionId: SessionId }) => {
  const { status, error, lastAttempt } = useSummarizerStatus(sessionId);
  const canRetry = lastAttempt !== null;
  const retrySummarizer = useAppStore((s) => s.retrySummarizer);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status !== 'error') setRetrying(false);
  }, [status]);

  if (status === 'running') {
    return <SummarizerWorkingIndicator />;
  }

  if (status === 'error') {
    const errorTitle = error ? `Cannot summarize · ${error}` : 'Cannot summarize';
    return (
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
    );
  }

  return null;
};
