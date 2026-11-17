import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { useAppStore } from '../../../../../store';
import { EXPANDED_THREAD_ID, SESSION, seedResolveScene } from '../resolveSeed';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';

type Props = {
  readonly extraThreadIds: ReadonlyArray<string>;
};

export const CommentRunComposeScene = ({ extraThreadIds }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: EXPANDED_THREAD_ID });
    const state = useAppStore.getState();
    state.openCommentRunStart({ sessionId: SESSION.id, threadId: EXPANDED_THREAD_ID });
    state.setCommentRunExtras({
      sessionId: SESSION.id,
      threadId: EXPANDED_THREAD_ID,
      extraThreadIds,
    });
    setIsReady(true);
  }, [extraThreadIds]);

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
