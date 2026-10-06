import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../features/branch/components/BranchPage';
import { useAppStore } from '../../../../store';
import { SELECTION_THREAD_IDS, SESSION, seedResolveScene } from './resolveSeed';

export const ResolveLaunchScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: null, selectable: true });
    const state = useAppStore.getState();
    state.setReviewSelection({ sessionId: SESSION.id, threadIds: SELECTION_THREAD_IDS });
    state.requestReviewLaunch({ sessionId: SESSION.id, threadIds: SELECTION_THREAD_IDS });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <BranchPage session={SESSION} workingDir={null} />
    </main>
  );
};
