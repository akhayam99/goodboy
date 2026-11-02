import { Button } from '@goodboy/ui';
import type { MountPreflight } from './SessionOverviewPane/ProjectMountRows/useMountPreflight/resolveMountPreflight';

type PickParams = {
  readonly branch: string;
};

export type ExistingBranchFacts = Pick<
  MountPreflight,
  'branch' | 'isExistingBranch' | 'isNamedByGoal' | 'goalBranches' | 'checkedOutAt'
>;

type Props = {
  readonly facts: ExistingBranchFacts;
  readonly isBusy: boolean;
  readonly onPickBranch: (params: PickParams) => void;
  readonly onUseWorktree: () => void;
  readonly onNewBranch: () => void;
};

export const ExistingBranchNotice = ({
  facts,
  isBusy,
  onPickBranch,
  onUseWorktree,
  onNewBranch,
}: Props) => (
  <>
    {facts.isExistingBranch ? (
      <p role="status" className="text-meta text-muted-foreground">
        Uses the existing branch {facts.branch}
        {facts.isNamedByGoal ? ', named in the goal.' : '.'}
      </p>
    ) : null}
    {facts.checkedOutAt === null ? null : (
      <div role="group" aria-label="Branch checked out elsewhere" className="flex flex-col gap-1">
        <p role="status" className="text-meta text-warning">
          {facts.branch} is already checked out in another worktree at {facts.checkedOutAt}.
        </p>
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" disabled={isBusy} onClick={onUseWorktree}>
            Open the existing worktree
          </Button>
          <Button variant="ghost" size="sm" disabled={isBusy} onClick={onNewBranch}>
            Start on a new branch
          </Button>
        </div>
      </div>
    )}
    {facts.goalBranches.length === 0 ? null : (
      <div role="group" aria-label="Branches named in the goal" className="flex flex-col gap-1">
        <p className="text-meta text-warning">
          The goal names {facts.goalBranches.length} branches
        </p>
        <div className="flex flex-wrap gap-1">
          {facts.goalBranches.map((branch) => (
            <Button
              key={branch}
              variant="ghost"
              size="sm"
              disabled={isBusy}
              onClick={() => onPickBranch({ branch })}
              className="text-code"
            >
              {branch}
            </Button>
          ))}
        </div>
      </div>
    )}
  </>
);
