import type { WorkspaceId } from '@goodboy/types';
import { ExistingBranchNotice } from '../../ExistingBranchNotice';
import { useDraftBranchFacts } from '../useDraftBranchFacts';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isDisabled: boolean;
};

export const StartBranchNotice = ({ workspaceId, isDisabled }: Props) => {
  const { facts, error, choose } = useDraftBranchFacts({ workspaceId });
  if (facts === null && error === null) {
    return null;
  }
  return (
    <section aria-label="Branch" className="flex min-w-0 flex-col gap-2">
      {facts === null ? null : (
        <ExistingBranchNotice
          facts={facts}
          isBusy={isDisabled}
          onPickBranch={({ branch }) => choose({ pick: { kind: 'branch', branch } })}
          onUseWorktree={() => {
            if (facts.branch === null || facts.checkedOutAt === null) {
              return;
            }
            choose({
              pick: { kind: 'worktree', branch: facts.branch, worktreePath: facts.checkedOutAt },
            });
          }}
          onNewBranch={() => choose({ pick: { kind: 'new-branch' } })}
        />
      )}
      {error === null ? null : (
        <p className="text-meta text-muted-foreground">
          Couldn't read the existing branches, so a branch named in the goal wasn't checked: {error}
        </p>
      )}
    </section>
  );
};
