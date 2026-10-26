import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useSessionMountHosts } from '../../../../shared/hooks/useSessionMountHosts';
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
  readonly selected: ReviewSourceEntry | null;
  readonly source: ActiveReviewSource | null;
};

type Params = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
};

export const useActiveReviewSource = ({ sessionId, mountId = null }: Params): Result => {
  const hosts = useSessionMountHosts({ sessionId });
  const rest = useAppStore(
    useShallow((s): Omit<ReviewSourceSelectionState, keyof typeof hosts> => ({
      sessions: s.sessions,
      projects: s.projects,
      sessionProjectMounts: s.sessionProjectMounts,
      sessionMounts: s.sessionMounts,
      sessionActiveProject: s.sessionActiveProject,
      sessionActiveMount: s.sessionActiveMount,
      sessionGithub: s.sessionGithub,
      sessionGitlabMr: s.sessionGitlabMr,
      sessionBitbucketPr: s.sessionBitbucketPr,
      reviewSourceThreads: s.reviewSourceThreads,
      reviewSourceKeys: s.reviewSourceKeys,
    })),
  );
  return useMemo(() => {
    const slice: ReviewSourceSelectionState = { ...rest, ...hosts };
    return {
      entries: reviewSourceEntriesOf({ state: slice, sessionId }),
      selected: selectedReviewEntryOf({ state: slice, sessionId, mountId }),
      source: activeReviewSourceOf({ state: slice, sessionId, mountId }),
    };
  }, [hosts, mountId, rest, sessionId]);
};
