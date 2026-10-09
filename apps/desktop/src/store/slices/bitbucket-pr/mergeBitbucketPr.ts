import { bitbucketMergePullRequest } from '../../../features/integrations/bitbucket/client';
import { runBitbucketPrWrite } from './runBitbucketPrWrite';
import type { BitbucketPrMergeParams, GetFn, SetFn } from './types';

export const mergeBitbucketPr = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId, repo, pullRequestId, strategy }: BitbucketPrMergeParams) => {
    await runBitbucketPrWrite({
      set,
      get,
      sessionId,
      ...(mountId === undefined ? {} : { mountId }),
      repo,
      pullRequestId,
      write: async () => {
        await bitbucketMergePullRequest({
          ...repo,
          pullRequestId,
          ...(strategy === undefined ? {} : { strategy }),
        });
      },
    });
  };
};
