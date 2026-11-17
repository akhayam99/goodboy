import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { SESSION, seedResolveScene } from '../resolveSeed';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';
import { BROAD_THREAD_ID, seedBroadComment } from './seedBroadComment';

export const CommentRunSuggestScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: BROAD_THREAD_ID });
    seedBroadComment();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <WorktreeSceneColumn>
        <BranchPage session={SESSION} workingDir={null} />
      </WorktreeSceneColumn>
    </main>
  );
};
