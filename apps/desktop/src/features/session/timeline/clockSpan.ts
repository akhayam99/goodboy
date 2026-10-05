import { formatClock } from '../../../shared/utils/time/formatClock';
import type { RowPhase } from '../../workTreeModel/rowState';
import type { TimelineAgentEntry } from './buildTimelineGroups';

type EntriesParams = {
  readonly entries: ReadonlyArray<TimelineAgentEntry>;
};

export const latestFinishOf = ({ entries }: EntriesParams): number | null => {
  let latest: number | null = null;
  for (const entry of entries) {
    const own = entry.agent.completedAt ?? entry.agent.lastFinishedAt ?? null;
    const parsed = own === null ? Number.NaN : Date.parse(own);
    if (!Number.isNaN(parsed) && (latest === null || parsed > latest)) {
      latest = parsed;
    }
    const nested = latestFinishOf({ entries: entry.children });
    if (nested !== null && (latest === null || nested > latest)) {
      latest = nested;
    }
  }
  return latest;
};

type SpanParams = {
  readonly startedAt: string;
  readonly finishedAt: string | number | null;
  readonly phase: RowPhase;
};

export const clockSpanText = ({ startedAt, finishedAt, phase }: SpanParams): string => {
  const started = `Started ${formatClock({ at: startedAt })}`;
  if (phase === 'running') {
    return `${started} · running`;
  }
  const isFinished = phase === 'done' || phase === 'failed' || phase === 'closed';
  if (isFinished && finishedAt !== null) {
    return `${started} · finished ${formatClock({ at: finishedAt })}`;
  }
  return started;
};
