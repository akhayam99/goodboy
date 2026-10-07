import { WorkNode } from '@goodboy/ui';
import type { ResolveAttempt } from '@goodboy/types';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { fixRunModelLabel } from '../../fixRun';
import type { FixRunStatus } from '../../fixRunStatus';
import { FIX_RUN_COPY } from '../../reviewFlowCopy';

type Props = {
  readonly attempt: ResolveAttempt;
  readonly status: Exclude<FixRunStatus, 'ended'>;
};

const WORD: Readonly<Record<Props['status'], string>> = {
  queued: FIX_RUN_COPY.statusQueued,
  working: FIX_RUN_COPY.statusWorking,
  waiting: FIX_RUN_COPY.statusWaiting,
};

export const FixRunStatusLine = ({ attempt, status }: Props) => {
  const now = useNow(1_000);
  const since = attempt.startedAt ?? attempt.createdAt;
  const parts = [
    WORD[status],
    ...(status === 'queued' ? [] : [formatDuration({ durationMs: Math.max(0, now - since) })]),
    fixRunModelLabel({ attempt }),
  ];
  return (
    <p
      data-testid="fix-run-status"
      aria-live="polite"
      className="flex min-w-0 items-center gap-2 text-label text-muted-foreground"
    >
      <WorkNode state="running" label={WORD[status]} mark={{ kind: 'dot' }} />
      <span className="min-w-0 truncate">{parts.join(' · ')}</span>
    </p>
  );
};
