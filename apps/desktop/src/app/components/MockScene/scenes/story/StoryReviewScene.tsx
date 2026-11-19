import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { branchPlace } from '../../../../../store/slices/navigation/place';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import { MOUNT_TARGET } from '../resolveSeed';
import { STORY_REVIEW_SESSION, openStoryFixDrawer, seedStoryReview } from './storyReviewSeed';

export const StoryReviewScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const { navigate } = useAppStore.getInitialState();
    seedStoryReview();
    useAppStore.setState({ navigate });
    navigate({
      to: branchPlace({
        sessionId: STORY_REVIEW_SESSION.id,
        mountPath: MOUNT_TARGET.worktreePath,
        tab: 'comments',
      }),
    });
    openStoryFixDrawer();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return <WorkspaceFrame session={STORY_REVIEW_SESSION} />;
};
