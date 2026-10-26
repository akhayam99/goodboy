import { bitbucketReviewSource } from '@goodboy/core';
import type { MountId, SessionId } from '@goodboy/types';
import { bitbucketReviewTransport } from '../../../features/integrations/bitbucket/bitbucketReviewTransport';
import { sessionMountTargets } from '../project-mounts/mountRequests';
import { bitbucketThreadsKey, openBitbucketPullRequestsOf } from './reviewSourceEntries';
import { refreshSourceThreads } from './refreshSourceThreads';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly isForced: boolean;
  readonly isQuiet: boolean;
};

export const refreshBitbucketReviewThreads = async ({
  set,
  get,
  sessionId,
  mountId,
  isForced,
  isQuiet,
}: Params): Promise<void> => {
  const target = sessionMountTargets({ state: get(), sessionId }).find(
    (candidate) => candidate.id === mountId,
  );
  const bitbucket = get().mountBitbucketPr?.[mountId];
  const repo = bitbucket?.repo ?? null;
  if (target === undefined || bitbucket === undefined || repo === null) {
    return;
  }
  await Promise.all(
    openBitbucketPullRequestsOf({ bitbucket }).map(async (pr) => {
      const source = bitbucketReviewSource({
        transport: bitbucketReviewTransport({ repo, pullRequestId: pr.id }),
        prUrl: pr.webUrl,
      });
      await refreshSourceThreads({
        set,
        get,
        sessionId,
        mountId,
        projectId: target.projectId,
        kind: 'bitbucket',
        key: bitbucketThreadsKey({ mountId, pr }),
        prNumber: pr.id,
        isForced,
        isQuiet,
        listComments: async () => (await source.listThreads()).flatMap((thread) => thread.comments),
      });
    }),
  );
};
