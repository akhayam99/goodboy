import { useMemo } from 'react';
import type { PullRequestPort } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { pullRequestPortFor } from '../../../../store/slices/review-source/pullRequestPortFor';

type Params = {
  readonly sessionId: SessionId;
};

export const usePullRequestPort = ({ sessionId }: Params): PullRequestPort | null => {
  const prNumber = useAppStore((state) => state.sessionGithub[sessionId]?.pr?.number ?? null);
  const mountId = useAppStore((state) => state.sessionActiveMount?.[sessionId] ?? null);
  return useMemo(
    () => (prNumber === null ? null : pullRequestPortFor({ get: useAppStore.getState, sessionId })),
    [mountId, prNumber, sessionId],
  );
};
