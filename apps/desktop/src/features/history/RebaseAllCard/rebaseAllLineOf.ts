import type { Tone } from '@goodboy/ui';
import type { HistoryRun } from '../../../store/slices/history/types';
import type { RebaseAllBranch, RebaseAllRun } from '../../../store/slices/rebaseAll/types';
import { conflictCountLabelOf } from '../rebaseConflictLine';
import { rebaseConflictOf } from '../rebaseConflictOf';

export type RebaseAllLine = {
  readonly text: string;
  readonly tone: Tone;
  readonly isPulsing: boolean;
};

type LineParams = {
  readonly branch: RebaseAllBranch;
  readonly historyRun: HistoryRun | null;
  readonly behind: number | null;
  readonly isRebasingHere: boolean;
};

type ConflictCountParams = {
  readonly historyRun: HistoryRun | null;
};

const conflictLabelOf = ({ historyRun }: ConflictCountParams): string => {
  const conflict = rebaseConflictOf({ run: historyRun });
  if (conflict === null || conflict.count === 0) {
    return 'a conflict';
  }
  return conflictCountLabelOf({ count: conflict.count });
};

const progressTextOf = ({ historyRun }: ConflictCountParams): string => {
  const progress = historyRun?.progress ?? null;
  if (progress?.stage === 'step' && progress.index > 0) {
    return `Replaying ${progress.index} of ${progress.total}`;
  }
  return 'Rebasing';
};

export const rebaseAllLineOf = ({
  branch,
  historyRun,
  behind,
  isRebasingHere,
}: LineParams): RebaseAllLine => {
  switch (branch.state) {
    case 'queued':
      return { text: 'Waiting', tone: 'neutral', isPulsing: false };
    case 'rebasing':
      return { text: progressTextOf({ historyRun }), tone: 'info', isPulsing: true };
    case 'rebased':
      return { text: 'Rebased', tone: 'success', isPulsing: false };
    case 'conflict':
      return {
        text: `Conflict in ${conflictLabelOf({ historyRun })}`,
        tone: 'warning',
        isPulsing: false,
      };
    case 'auto':
      return behind === 0 && !isRebasingHere
        ? { text: 'Rebased by Auto', tone: 'success', isPulsing: false }
        : {
            text: `Auto resolves ${conflictLabelOf({ historyRun })}`,
            tone: 'info',
            isPulsing: true,
          };
    case 'failed':
      return { text: branch.message ?? "Couldn't rebase", tone: 'danger', isPulsing: false };
    case 'skipped':
      return { text: 'Skipped', tone: 'neutral', isPulsing: false };
    default: {
      const exhaustive: never = branch.state;
      return exhaustive;
    }
  }
};

type SummaryParams = {
  readonly run: RebaseAllRun;
};

const settledCountOf = ({ run }: SummaryParams): number =>
  run.branches.filter((branch) => branch.state !== 'queued' && branch.state !== 'rebasing').length;

export const rebaseAllSummaryOf = ({ run }: SummaryParams): string => {
  const total = run.branches.length;
  switch (run.phase) {
    case 'running':
      return run.isAborted
        ? 'Stopping after this branch'
        : `Rebasing ${Math.min(settledCountOf({ run }) + 1, total)} of ${total} branches`;
    case 'handing':
      return 'Handing the rest to Auto';
    case 'handed':
      return 'Auto has the rest, one branch at a time';
    case 'aborted':
      return 'Stopped. Finished branches stay rebased.';
    case 'done':
      return run.error ?? `${total} branches done`;
    default: {
      const exhaustive: never = run.phase;
      return exhaustive;
    }
  }
};
