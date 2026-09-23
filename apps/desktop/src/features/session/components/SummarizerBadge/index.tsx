import { cn as tokenCn, tintClasses as tokenTintClasses } from '@goodboy/ui';
import { useEffect, useState } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useSummarizerStatus } from '../../../../store';

export const SummarizerBadge = ({ sessionId }: { sessionId: SessionId }) => {
  const { status, error, lastAttempt } = useSummarizerStatus(sessionId);
  const canRetry = lastAttempt !== null;
  const retrySummarizer = useAppStore((s) => s.retrySummarizer);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status !== 'error') setRetrying(false);
  }, [status]);

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
          tokenCn(
            'inline-flex h-6 shrink-0 items-center gap-1 rounded-md',
            tokenTintClasses('danger').bg,
            'px-2 text-2xs text-danger motion-safe:transition-colors',
          ),
          retrying && 'animate-border-pulse',
          canRetry
            ? tokenCn(tokenTintClasses('danger').hoverBg, 'hover:text-on-tone')
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
