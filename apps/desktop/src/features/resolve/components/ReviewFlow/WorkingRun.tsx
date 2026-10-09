import { useMemo } from 'react';
import { stripControlMarkers } from '@goodboy/core';
import { WorkNode } from '@goodboy/ui';
import type { ResolveAttempt } from '@goodboy/types';
import { useTranscript } from '../../../../store/slices/transcripts/selectors';
import { reduceTranscript } from '../../../chat/utils/transcript-items';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { fixRunModelLabel } from '../../fixRun';
import { LANE_QUEUED_SENTENCE } from '../../laneCopy';
import { FIX_RUN_THREAD_COPY } from '../../reviewFlowCopy';

type Props = {
  readonly attempt: ResolveAttempt;
};

const lastLineOf = ({ text }: { readonly text: string }): string =>
  stripControlMarkers(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .at(-1) ?? '';

export const WorkingRun = ({ attempt }: Props) => {
  const transcript = useTranscript(attempt.agentId);
  const now = useNow(1_000);
  const isWaiting = attempt.phase === 'queued';
  const step = useMemo(() => {
    const items = reduceTranscript(transcript);
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item?.kind === 'assistant_text') {
        return lastLineOf({ text: item.text });
      }
    }
    return '';
  }, [transcript]);
  const since = attempt.startedAt ?? attempt.createdAt;
  const elapsed = formatDuration({ durationMs: Math.max(0, now - since) });
  return (
    <div
      role="group"
      aria-label={FIX_RUN_THREAD_COPY.working}
      data-testid="resolver-working"
      className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle p-4 ring-1 ring-border-soft"
    >
      <h2 className="flex items-center gap-2 text-label text-foreground">
        <WorkNode state="running" label={FIX_RUN_THREAD_COPY.working} mark={{ kind: 'dot' }} />
        {isWaiting ? FIX_RUN_THREAD_COPY.working : `${FIX_RUN_THREAD_COPY.working} · ${elapsed}`}
      </h2>
      <p aria-live="polite" className="min-w-0 truncate text-body text-muted-foreground">
        {isWaiting ? LANE_QUEUED_SENTENCE : step}
      </p>
      <p className="text-meta text-faint-foreground">
        {FIX_RUN_THREAD_COPY.sameRun} · {fixRunModelLabel({ attempt })}
      </p>
    </div>
  );
};
