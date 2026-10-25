import type { SessionId } from '@goodboy/types';
import { sessionMountTargets } from '../project-mounts/mountRequests';
import { refreshBitbucketReviewThreads } from './refreshBitbucketReviewThreads';
import { refreshGitlabReviewThreads } from './refreshGitlabReviewThreads';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly hosts: ReadonlyArray<'gitlab' | 'bitbucket'>;
  readonly isForced: boolean;
  readonly isQuiet: boolean;
};

export const refreshSessionReviewThreads = async ({
  set,
  get,
  sessionId,
  hosts,
  isForced,
  isQuiet,
}: Params): Promise<void> => {
  const mountIds = sessionMountTargets({ state: get(), sessionId }).map((target) => target.id);
  await Promise.all(
    mountIds.flatMap((mountId) => [
      ...(hosts.includes('gitlab')
        ? [refreshGitlabReviewThreads({ set, get, sessionId, mountId, isForced, isQuiet })]
        : []),
      ...(hosts.includes('bitbucket')
        ? [refreshBitbucketReviewThreads({ set, get, sessionId, mountId, isForced, isQuiet })]
        : []),
    ]),
  );
};
