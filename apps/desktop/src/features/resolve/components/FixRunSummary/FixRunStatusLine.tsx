import { StatusDot, WorkNode } from '@goodboy/ui';
import type { ResolveAttempt } from '@goodboy/types';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { fixRunModelLabel } from '../../fixRun';
import type { FixRunStatus } from '../../fixRunStatus';
import { FIX_RUN_COPY } from '../../reviewFlowCopy';

type Props = {
  readonly attempt: ResolveAttempt;
  readonly status: FixRunStatus;
  readonly shared: SharedState | null;
};

export type SharedState = {
  readonly word: string;
  readonly count: number;
};

const WORD: Readonly<Record<FixRunStatus, string>> = {
  queued: FIX_RUN_COPY.statusQueued,
  working: FIX_RUN_COPY.statusWorking,
  waiting: FIX_RUN_COPY.statusWaiting,
  ended: FIX_RUN_COPY.statusDone,
};

export const FixRunStatusLine = ({ attempt, status, shared }: Props) => {
  const now = useNow(1_000);
  const since = attempt.startedAt ?? attempt.createdAt;
  const until = status === 'ended' ? (attempt.endedAt ?? now) : now;
  const parts = [
    WORD[status],
    ...(status === 'queued' ? [] : [formatDuration({ durationMs: Math.max(0, until - since) })]),
    ...(shared === null || status !== 'ended' ? [] : [FIX_RUN_COPY.sharedState(shared)]),
    fixRunModelLabel({ attempt }),
  ];
  return (
    <p
      data-testid="fix-run-status"
      aria-live="polite"
      className="flex min-w-0 items-center gap-2 text-label text-muted-foreground"
    >
      {status === 'ended' ? (
        <StatusDot tone="success" size="sm" />
      ) : (
        <WorkNode state="running" label={WORD[status]} mark={{ kind: 'dot' }} />
      )}
      <span className="min-w-0 truncate">{parts.join(' · ')}</span>
    </p>
  );
};
