import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';
import { SESSION } from '../resolveSeed';
import { PR_PAGE_WORKTREE, applyPrPageSeed, applyRemovedMountSeed } from '../u23/prPageSeed';

type Props = {
  readonly isRemoved?: boolean;
};

export const BranchMergedScene = ({ isRemoved = false }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyPrPageSeed({ variant: 'merged' });
    if (isRemoved) {
      applyRemovedMountSeed();
    }
    setIsReady(true);
  }, [isRemoved]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <WorktreeSceneColumn>
        <BranchPage session={SESSION} workingDir={PR_PAGE_WORKTREE} />
      </WorktreeSceneColumn>
    </main>
  );
};
