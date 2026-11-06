import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';
import { SESSION } from '../resolveSeed';
import { PR_PAGE_WORKTREE, applyPrPageSeed } from '../u23/prPageSeed';

export const BranchMergedScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyPrPageSeed({ variant: 'merged' });
    setIsReady(true);
  }, []);

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
