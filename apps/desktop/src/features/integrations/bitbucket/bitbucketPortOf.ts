import { bitbucketPullRequestPort, type PullRequestPort } from '@goodboy/core';
import type { MountId, SessionId } from '@goodboy/types';
import type { GetFn } from '../../../store/slice-types';
import { selectBitbucketRequest } from '../../../store/slices/bitbucket-pr/selectBitbucketRequest';
import { bitbucketPullRequestTransport } from './bitbucketPullRequestTransport';

type Params = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  mountId?: MountId;
  prNumber?: number;
}>;

export const bitbucketPortOf = ({
  get,
  sessionId,
  mountId,
  prNumber,
}: Params): PullRequestPort | null => {
  const request = selectBitbucketRequest({
    state: get(),
    sessionId,
    ...(mountId === undefined ? {} : { mountId }),
    ...(prNumber === undefined ? {} : { prNumber }),
  });
  if (request === null) {
    return null;
  }
  return bitbucketPullRequestPort({
    transport: bitbucketPullRequestTransport({ repo: request.repo, pullRequestId: request.pr.id }),
    prUrl: request.pr.webUrl,
  });
};
