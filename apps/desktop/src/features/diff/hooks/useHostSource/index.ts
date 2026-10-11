import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  activeReviewSourceOf,
  type ReviewSourceSelectionState,
} from '../../../../store/slices/review-source/activeReviewSource';
import type { ActiveReviewSource } from '../../../../store/slices/review-source/types';

type Params = {
  readonly sessionId: SessionId;
};

export const useHostSource = ({ sessionId }: Params): ActiveReviewSource | null => {
  const slice = useAppStore(
    useShallow((s): ReviewSourceSelectionState => ({
      sessions: s.sessions,
      projects: s.projects,
      sessionProjectMounts: s.sessionProjectMounts,
      sessionMounts: s.sessionMounts,
      sessionActiveProject: s.sessionActiveProject,
      sessionActiveMount: s.sessionActiveMount,
      sessionGithub: s.sessionGithub,
      sessionGitlabMr: s.sessionGitlabMr,
      mountGithub: s.mountGithub,
      mountGitlabMr: s.mountGitlabMr,
      mountBitbucketPr: s.mountBitbucketPr,
      sessionBitbucketPr: s.sessionBitbucketPr,
      reviewSourceThreads: s.reviewSourceThreads,
      reviewSourceKeys: s.reviewSourceKeys,
    })),
  );
  return useMemo(() => activeReviewSourceOf({ state: slice, sessionId }), [sessionId, slice]);
};
