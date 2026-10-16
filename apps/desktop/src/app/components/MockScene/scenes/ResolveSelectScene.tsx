import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../features/branch/components/BranchPage';
import { WorktreeSceneColumn } from './WorktreeSceneColumn';
import { useAppStore } from '../../../../store';
import { SELECTION_THREAD_IDS, SESSION, seedResolveScene } from './resolveSeed';

export const ResolveSelectScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: null, selectable: true });
    useAppStore
      .getState()
      .setReviewSelection({ sessionId: SESSION.id, threadIds: SELECTION_THREAD_IDS });
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
