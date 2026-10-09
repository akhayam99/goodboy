import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { SESSION } from '../resolveSeed';
import {
  BITBUCKET_PAGE_WORKTREE,
  applyBitbucketPageSeed,
  type BitbucketPageVariant,
} from './bitbucketSeed';

const OPEN_DELAY_MS = 500;

type Props = {
  readonly variant: BitbucketPageVariant;
};

export const BitbucketPageScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyBitbucketPageSeed({ variant });
    setIsReady(true);
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
      <BranchPage session={SESSION} workingDir={BITBUCKET_PAGE_WORKTREE} />
    </main>
  );
};
