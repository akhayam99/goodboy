import type { PullRequestHost, SessionId } from '@goodboy/types';
import type { GetFn } from '../../slice-types';
import type { RefreshPrOptions } from '../github/refreshMountPr';

type RefreshRequestsOptions = Pick<RefreshPrOptions, 'mountId' | 'force' | 'silent' | 'retries'>;

type Params = Readonly<{
  get: GetFn;
  host: PullRequestHost;
  sessionId: SessionId;
  options: RefreshRequestsOptions;
}>;

export const refreshMountRequests = async ({
  get,
  host,
  sessionId,
  options,
}: Params): Promise<void> => {
  if (host === 'bitbucket') {
    await get().refreshSessionBitbucketPr(sessionId, options);
    return;
  }
  if (host === 'gitlab') {
    await get().refreshSessionMr(sessionId, options);
    return;
  }
  await get().refreshSessionPr(sessionId, options);
};
