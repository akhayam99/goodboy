import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { SESSION } from '../resolveSeed';
import { GITLAB_PAGE_WORKTREE, applyGitlabSeed, type GitlabPageVariant } from './gitlabSeed';

const OPEN_DELAY_MS = 900;

type Props = {
  readonly variant: GitlabPageVariant;
};

export const GitlabPageScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    void applyGitlabSeed({ variant }).then(() => {
      if (!isCancelled) {
        setIsReady(true);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [variant]);

  useEffect(() => {
    if (!isReady || variant !== 'merge') {
      return;
    }
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>('[data-branch-primary="pullRequest.merge"]')?.click();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isReady, variant]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <BranchPage session={SESSION} workingDir={GITLAB_PAGE_WORKTREE} />
    </main>
  );
};
