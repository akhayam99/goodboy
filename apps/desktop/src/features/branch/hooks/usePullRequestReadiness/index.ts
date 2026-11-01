import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
import { viewerLoginsOf } from '../../../../store/slices/resolve/viewerLogins';
import { groupThreads } from '../../../integrations/github/comment-threads';
import { commentsCountOf } from '../../../resolve/commentsCountOf';
import { newThreadIdsOf } from '../../../resolve/newThreadIdsOf';
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
  readonly commentsNew: number;
  readonly reviewers: PullRequestReviewerGroups;
};

const NO_REVIEWERS: ReadonlyArray<PullRequestReviewer> = [];
const NO_READS: Readonly<Record<string, number>> = {};

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
  const reads = useAppStore((state) => state.sessionThreadReads?.[sessionId]);
  const loadThreadReads = useAppStore((state) => state.loadThreadReads);
  const viewerLogins = useAppStore(useShallow((state) => [...viewerLoginsOf({ state })].sort()));
  const threadKey = threads.map((thread) => thread.threadId).join('|');
  useEffect(() => {
    void loadThreadReads({ sessionId });
  }, [loadThreadReads, sessionId, threadKey]);
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
    const commentThreads = new Map(
      groupThreads(
        (detail?.comments ?? []).filter((comment) => comment.source === 'review'),
      ).flatMap((thread) =>
        thread.head.threadId == null ? [] : [[thread.head.threadId, thread] as const],
      ),
    );
    const newThreadIds = newThreadIdsOf({
      entries: threads.map((thread) => ({
        thread,
        commentThread: commentThreads.get(thread.threadId) ?? null,
      })),
      reads: reads ?? NO_READS,
      viewerLogins: new Set(viewerLogins),
    });
    return {
      readiness: evaluatePrMergeReadiness({ facts }),
      facts,
      commentsNeedYou: facts.commentsNeedYou,
      commentsNew: commentsCountOf({ threads, newThreadIds }).newCount,
      reviewers: pullRequestReviewerGroupsOf({ reviewers }),
    };
  }, [github, host, isRebaseStopOpen, reads, sessionId, threads, view, viewerLogins]);
};
