import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { useAppStore } from '../../../../../store';
import { branchPlace } from '../../../../../store/slices/navigation/place';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';
import { SESSION } from '../resolveSeed';
import { WORKSPACE_SIBLINGS, seedWorkspaceChrome } from '../audit/workspaceChrome';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import { seedCommentsScene, type CommentsVariant } from './commentsSeed';

const DRILL_MS = 200;

type Props = {
  readonly variant: CommentsVariant;
};

export const CommentsScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedCommentsScene({ variant });
    if (variant === 'push-failed') {
      seedWorkspaceChrome({ session: SESSION, siblings: WORKSPACE_SIBLINGS });
    }
    setIsReady(true);
  }, [variant]);

  useEffect(() => {
    if (!isReady || variant !== 'push-failed') {
      return;
    }
    const timer = window.setTimeout(() => {
      useAppStore.getState().navigate({
        to: branchPlace({ sessionId: SESSION.id, tab: 'comments' }),
        mode: 'replace',
      });
    }, DRILL_MS);
    return () => window.clearTimeout(timer);
  }, [isReady, variant]);

  if (!isReady) {
    return null;
  }

  const page = <BranchPage session={SESSION} workingDir={null} />;

  if (variant === 'push-failed') {
    return <WorkspaceFrame session={SESSION} main={<div className="h-full w-full">{page}</div>} />;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <WorktreeSceneColumn>{page}</WorktreeSceneColumn>
    </main>
  );
};
