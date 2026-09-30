import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  activeReviewSourceOf,
  selectedReviewEntryOf,
  type ReviewSourceSelectionState,
} from '../../../../store/slices/review-source/activeReviewSource';
import { reviewSourceEntriesOf } from '../../../../store/slices/review-source/reviewSourceEntries';
import type {
  ActiveReviewSource,
  ReviewSourceEntry,
} from '../../../../store/slices/review-source/types';

type Result = {
  readonly entries: ReadonlyArray<ReviewSourceEntry>;
  readonly selected: ReviewSourceEntry;
  readonly source: ActiveReviewSource | null;
};

export const useActiveReviewSource = ({ sessionId }: { readonly sessionId: SessionId }): Result => {
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
      diffComments: s.diffComments,
      reviewSourceThreads: s.reviewSourceThreads,
      reviewSourceKeys: s.reviewSourceKeys,
    })),
  );
  return useMemo(
    () => ({
      entries: reviewSourceEntriesOf({ state: slice, sessionId }),
      selected: selectedReviewEntryOf({ state: slice, sessionId }),
      source: activeReviewSourceOf({ state: slice, sessionId }),
    }),
    [sessionId, slice],
  );
};
