import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { sessionMergeFacts } from '../../../actions/kinds/pullRequestFacts';
import { evaluatePrMergeReadiness, type PrMergeReadiness } from '../../../review/prMergeReadiness';

type Params = {
  readonly sessionId: SessionId;
};

export type PullRequestReadiness = {
  readonly readiness: PrMergeReadiness;
  readonly commentsNeedYou: number;
};

export const usePullRequestReadiness = ({ sessionId }: Params): PullRequestReadiness => {
  const github = useAppStore((state) => state.sessionGithub[sessionId] ?? null);
  const threads = useAppStore((state) => state.sessionResolveThreads?.[sessionId] ?? EMPTY_ARRAY);
  const attempts = useAppStore((state) => state.sessionResolveAttempts?.[sessionId] ?? EMPTY_ARRAY);
  const entry = useAppStore((state) => state.pullRequestViews[sessionId] ?? null);
  const view = entry !== null && entry.prNumber === github?.pr?.number ? entry.view : null;
  return useMemo(() => {
    const facts = sessionMergeFacts({ sessionId, github, threads, attempts, mergeView: view });
    return {
      readiness: evaluatePrMergeReadiness({ facts }),
      commentsNeedYou: facts.commentsNeedYou,
    };
  }, [attempts, github, sessionId, threads, view]);
};
