import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  activeReviewSourceOf,
  type ReviewSourceSelectionState,
} from '../../../../store/slices/review-source/activeReviewSource';
import type { ActiveReviewSource } from '../../../../store/slices/review-source/types';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
};

export const useHostSource = ({ sessionId, mountId = null }: Params): ActiveReviewSource | null => {
  const slice = useAppStore(
    useShallow((s): ReviewSourceSelectionState => ({
      sessions: s.sessions,
      projects: s.projects,
      sessionProjectMounts: s.sessionProjectMounts,
      sessionMounts: s.sessionMounts,
      sessionActiveProject: s.sessionActiveProject,
      sessionActiveMount: s.sessionActiveMount,
      sessionGithub: s.sessionGithub,
      sessionRequests: s.sessionRequests,
      mountGithub: s.mountGithub,
      mountRequests: s.mountRequests,
      reviewSourceThreads: s.reviewSourceThreads,
      reviewSourceKeys: s.reviewSourceKeys,
    })),
  );
  return useMemo(
    () => activeReviewSourceOf({ state: slice, sessionId, mountId }),
    [mountId, sessionId, slice],
  );
};
