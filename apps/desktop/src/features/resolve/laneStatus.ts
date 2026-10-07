import type { Agent, ResolveAttempt } from '@goodboy/types';
import { entryTitleOf } from './components/ReviewFlow/entryTitle';
import type { ReviewEntry } from './components/ReviewFlow/useReviewEntries';
import {
  isLaneRebuildAttempt,
  laneProgressLine,
  laneRebuildLine,
  laneWaitingLine,
} from './laneCopy';
import { laneHolderOf, laneQueueOf, lanePathsOf } from '../../store/slices/resolve/resolveLane';

export type LaneStatus = {
  readonly worktreePath: string;
  readonly line: string;
  readonly total: number;
  readonly queuedCount: number;
  readonly rebuildLine: string | null;
};

type Params = {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly agents: ReadonlyArray<Agent>;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

export const laneStatusOf = ({ attempts, agents, entries }: Params): LaneStatus | null => {
  for (const worktreePath of lanePathsOf({ attempts })) {
    const holder = laneHolderOf({ attempts, agents, worktreePath });
    const queued = laneQueueOf({ attempts, worktreePath });
    if (holder === null && queued.length === 0) {
      continue;
    }
    const threadIds = [
      ...new Set([...(holder?.threadIds ?? []), ...queued.flatMap((attempt) => attempt.threadIds)]),
    ];
    const members = threadIds.flatMap((threadId) => {
      const entry = entries.find((candidate) => candidate.threadId === threadId);
      return entry === undefined ? [] : [entry];
    });
    if (members.length === 0) {
      continue;
    }
    const pending = members.filter((entry) => entry.state === 'drafting');
    const isAsking = members.some((entry) => entry.state === 'needs');
    const total = members.length;
    const line =
      pending.length === 0 && isAsking
        ? laneWaitingLine({ total, queued: queued.length })
        : laneProgressLine({
            position: Math.min(total, total - pending.length + 1),
            total,
            nextTitle: pending[1] === undefined ? null : entryTitleOf({ entry: pending[1] }),
          });
    const rebuilding = new Set(
      [...(holder === null ? [] : [holder]), ...queued]
        .filter((attempt) => isLaneRebuildAttempt({ attempt }))
        .flatMap((attempt) => attempt.threadIds),
    );
    return {
      worktreePath,
      line,
      total,
      queuedCount: queued.length,
      rebuildLine: rebuilding.size === 0 ? null : laneRebuildLine({ count: rebuilding.size }),
    };
  }
  return null;
};
