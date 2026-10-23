import { useMemo } from 'react';
import type { PullRequestPort } from '@goodboy/core';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionPullRequestOf } from '../../../../store/slices/review-source/sessionPullRequestOf';
import { pullRequestPortFor } from '../../../../store/slices/review-source/pullRequestPortFor';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

export const usePullRequestPort = ({ sessionId, mountId }: Params): PullRequestPort | null => {
  const prNumber = useAppStore(
    (state) => sessionPullRequestOf({ state, sessionId, mountId })?.number ?? null,
  );
  return useMemo(
    () =>
      prNumber === null
        ? null
        : pullRequestPortFor({
            get: useAppStore.getState,
            sessionId,
            ...(mountId === null ? {} : { mountId }),
            prNumber,
          }),
    [mountId, prNumber, sessionId],
  );
};
