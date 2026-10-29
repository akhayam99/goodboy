import { GitMerge } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import type { BranchCommit } from '@goodboy/types';
import type { CombineMode } from '../../historyPlan';
import { HistoryModeSwitch } from './HistoryModeSwitch';

type HistoryTakenInRow = {
  readonly commit: BranchCommit;
  readonly mode: CombineMode;
};

type Props = {
  readonly takenIn: ReadonlyArray<HistoryTakenInRow>;
  readonly isInteractive: boolean;
  readonly onModeChange: (sha: string, mode: CombineMode) => void;
  readonly onSeparate: (sha: string) => void;
};

export const HistoryTakenInList = ({ takenIn, isInteractive, onModeChange, onSeparate }: Props) => (
  <span className="flex flex-col gap-0.5 border-l border-border-soft pl-3">
    {takenIn.map((taken) => (
      <span
        key={taken.commit.sha}
        className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground"
      >
        <GitMerge size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="truncate text-foreground">{taken.commit.subject}</span>
        <span className="shrink-0 text-code tabular-nums">{taken.commit.shortSha}</span>
        {isInteractive ? (
          <HistoryModeSwitch
            mode={taken.mode}
            onChange={(mode) => onModeChange(taken.commit.sha, mode)}
            onSeparate={() => onSeparate(taken.commit.sha)}
          />
        ) : null}
      </span>
    ))}
  </span>
);
