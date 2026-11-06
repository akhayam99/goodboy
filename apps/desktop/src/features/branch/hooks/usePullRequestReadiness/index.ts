import { useMemo } from 'react';
import {
  pullRequestReviewerGroupsOf,
  pullRequestReviewersOf,
  type PullRequestReviewerGroups,
} from '@goodboy/core/review-source';
import type { MountId, PullRequestReviewer, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { pullRequestViewOf } from '../../../../store/slices/pull-request-view/pullRequestViewOf';
import { branchGithubOf } from '../../../../store/slices/github/branchGithubOf';
import {
  sessionPullRequestHostOf,
  sessionPullRequestOf,
} from '../../../../store/slices/review-source/sessionPullRequestOf';
import { useUnreadThreads } from '../../../../shared/hooks/useUnreadThreads';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import {
  pullRequestThreadsOf,
  pullRequestViewerOf,
  sessionMergeFacts,
  type PullRequestFacts,
} from '../../../actions/kinds/pullRequestFacts';
import { reviewCounts } from '../../../resolve/reviewCounts';
import { evaluatePrMergeReadiness, type PrMergeReadiness } from '../../../review/prMergeReadiness';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly isRebaseStopOpen: boolean;
  readonly unpushed?: number;
};

export type PullRequestReadiness = {
  readonly readiness: PrMergeReadiness;
  readonly facts: PullRequestFacts;
  readonly commentsNeedYou: number;
  readonly commentsUnread: number;
  readonly reviewers: PullRequestReviewerGroups;
};

const NO_REVIEWERS: ReadonlyArray<PullRequestReviewer> = [];

export const usePullRequestReadiness = ({
  sessionId,
  mountId,
  isRebaseStopOpen,
  unpushed = 0,
}: Params): PullRequestReadiness => {
  const githubState = useAppStore((state) => branchGithubOf({ state, sessionId, mountId }));
  const pr = useAppStore((state) => sessionPullRequestOf({ state, sessionId, mountId }));
  const host = useAppStore((state) => sessionPullRequestHostOf({ state, sessionId, mountId }));
  const github = useMemo(
    () => (githubState?.pr != null ? githubState : pr === null ? null : { pr, detail: null }),
    [githubState, pr],
  );
  const sessionThreads = useAppStore(
    (state) => state.sessionResolveThreads?.[sessionId] ?? EMPTY_ARRAY,
  );
  const projectId = useAppStore(
    (state) =>
      resolveSessionRepo({ state, sessionId, ...(mountId === null ? {} : { mountId }) })
        ?.projectId ?? null,
  );
  const viewer = useAppStore((state) => pullRequestViewerOf({ host, state }));
  const { unread } = useUnreadThreads({ sessionId, mountId });
  const prNumber = github?.pr?.number ?? null;
  const view = useAppStore(
    (state) => pullRequestViewOf({ state, sessionId, mountId, prNumber })?.view ?? null,
  );
  return useMemo(() => {
    const facts = sessionMergeFacts({
      sessionId,
      host,
      github,
      threads: pullRequestThreadsOf({ threads: sessionThreads, projectId, prNumber }),
      viewer,
      mergeView: view,
      isRebaseStopOpen,
      unpushed,
    });
    const detail = github?.detail ?? null;
    const reviewers =
      detail !== null && detail.prNumber === github?.pr?.number
        ? pullRequestReviewersOf({ reviews: detail.reviews, requests: detail.reviewRequests })
        : (view?.reviewers ?? NO_REVIEWERS);
    return {
      readiness: evaluatePrMergeReadiness({ facts }),
      facts,
      commentsNeedYou: facts.commentsNeedYou,
      commentsUnread: reviewCounts({ threads: [], unread }).unread,
      reviewers: pullRequestReviewerGroupsOf({ reviewers }),
    };
  }, [
    github,
    host,
    isRebaseStopOpen,
    prNumber,
    projectId,
    sessionId,
    sessionThreads,
    unpushed,
    unread,
    view,
    viewer,
  ]);
};
