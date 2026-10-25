import type { MountId, PullRequestHost, SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import type { RefreshPrOptions } from '../github/refreshMountPr';
import { refreshBitbucketReviewThreads } from './refreshBitbucketReviewThreads';
import { refreshGitlabReviewThreads } from './refreshGitlabReviewThreads';

type Params = SliceDeps &
  Readonly<{
    host: PullRequestHost;
    sessionId: SessionId;
    options: Pick<RefreshPrOptions, 'force' | 'silent' | 'retries'> &
      Readonly<{ mountId: MountId }>;
  }>;

export const refreshMountThreads = async ({
  set,
  get,
  host,
  sessionId,
  options,
}: Params): Promise<void> => {
  const thread = {
    set,
    get,
    sessionId,
    mountId: options.mountId,
    isForced: options.force === true,
    isQuiet: options.silent === true,
  };
  if (host === 'bitbucket') {
    await refreshBitbucketReviewThreads(thread);
    return;
  }
  if (host === 'gitlab') {
    await refreshGitlabReviewThreads(thread);
    return;
  }
  await get().refreshSessionPrDetail(sessionId, options);
};
