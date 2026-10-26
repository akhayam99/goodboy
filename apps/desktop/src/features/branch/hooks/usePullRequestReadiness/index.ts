import { useMemo } from 'react';
import {
  pullRequestReviewerGroupsOf,
  pullRequestReviewersOf,
  type PullRequestReviewerGroups,
} from '@goodboy/core';
import type { MountId, PullRequestReviewer, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { pullRequestViewOf } from '../../../../store/slices/pull-request-view/pullRequestViewOf';
import { branchGithubOf } from '../../../../store/slices/github/branchGithubOf';
import {
  sessionPullRequestHostOf,
  sessionPullRequestOf,
} from '../../../../store/slices/review-source/sessionPullRequestOf';
import { sessionMergeFacts, type PullRequestFacts } from '../../../actions/kinds/pullRequestFacts';
import { evaluatePrMergeReadiness, type PrMergeReadiness } from '../../../review/prMergeReadiness';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly isRebaseStopOpen: boolean;
};

export type PullRequestReadiness = {
  readonly readiness: PrMergeReadiness;
  readonly facts: PullRequestFacts;
  readonly commentsNeedYou: number;
  readonly reviewers: PullRequestReviewerGroups;
};

const NO_REVIEWERS: ReadonlyArray<PullRequestReviewer> = [];

export const usePullRequestReadiness = ({
  sessionId,
  mountId,
  isRebaseStopOpen,
}: Params): PullRequestReadiness => {
  const githubState = useAppStore((state) => branchGithubOf({ state, sessionId, mountId }));
  const pr = useAppStore((state) => sessionPullRequestOf({ state, sessionId, mountId }));
  const host = useAppStore((state) => sessionPullRequestHostOf({ state, sessionId, mountId }));
  const github = useMemo(
    () => (githubState?.pr != null ? githubState : pr === null ? null : { pr, detail: null }),
    [githubState, pr],
  );
  const threads = useAppStore((state) => state.sessionResolveThreads?.[sessionId] ?? EMPTY_ARRAY);
  const prNumber = github?.pr?.number ?? null;
  const view = useAppStore(
    (state) => pullRequestViewOf({ state, sessionId, mountId, prNumber })?.view ?? null,
  );
  return useMemo(() => {
    const facts = sessionMergeFacts({
      sessionId,
      host,
      github,
      threads,
      mergeView: view,
      isRebaseStopOpen,
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
      reviewers: pullRequestReviewerGroupsOf({ reviewers }),
    };
  }, [github, host, isRebaseStopOpen, sessionId, threads, view]);
};
