import { StatusDot } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { RebaseAllBranch } from '../../../store/slices/rebaseAll/types';
import { rebaseAllLineOf } from './rebaseAllLineOf';

type Props = {
  readonly branch: RebaseAllBranch;
  readonly behind: number | null;
  readonly isRebasingHere: boolean;
};

export const RebaseAllBranchLine = ({ branch, behind, isRebasingHere }: Props) => {
  const historyRun = useAppStore((s) => s.historyRuns[branch.mountId] ?? null);
  const line = rebaseAllLineOf({ branch, historyRun, behind, isRebasingHere });
  return (
    <li
      data-rebase-all-branch={branch.mountId}
      data-state={branch.state}
      className="flex min-h-6 min-w-0 items-center gap-2 text-ui"
    >
      <StatusDot tone={line.tone} size="sm" pulsing={line.isPulsing} />
      <span className="min-w-0 shrink truncate text-foreground">{branch.projectName}</span>
      <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">{line.text}</span>
    </li>
  );
};
